import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@sanity/client";
import { prismaWrite } from "@/lib/prismaClient";

/**
 * Applies a stock edit made in Sanity Studio to the Neon database.
 *
 * The Studio never sends the new stock value here directly. It first creates an
 * `inventoryAdjustment` document in Sanity with the editor's own session (only
 * project members can write to the dataset), then posts that document's id to
 * this route. We read the document back with our server token, so the request
 * is only as trustworthy as a Sanity login — nothing secret lives in the Studio.
 *
 * An adjustment is either a plain `set`, or an `undo`/`redo` of an earlier
 * applied `set` (its `target`). Undo and redo reverse or replay the target's
 * difference against today's stock rather than restoring its old number, so
 * orders placed in between are kept.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// Adjustments are applied straight after they are created; anything older is
// either a replay or an abandoned save and should be redone from the Studio.
const MAX_ADJUSTMENT_AGE_MS = 5 * 60 * 1000;

const sanityClient = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET!,
  useCdn: false,
  apiVersion: "2023-05-03",
  token: process.env.SANITY_API_TOKEN,
});

type AdjustmentKind = "set" | "undo" | "redo";

interface InventoryAdjustment {
  _id: string;
  _type: string;
  _rev: string;
  _createdAt: string;
  sku: string;
  previousStock: number;
  newStock: number;
  status: "pending" | "applied" | "rejected";
  // Entries logged before undo/redo existed have no kind and are plain sets
  kind?: AdjustmentKind;
  target?: { _ref: string };
  undone?: boolean;
}

/** Why `adjustment` can't undo/redo `target`, or null if it can. */
function undoRedoProblem(
  adjustment: InventoryAdjustment,
  target: InventoryAdjustment | null
): string | null {
  if (!target || target._type !== "inventoryAdjustment") return "The change being undone no longer exists";
  if (target.status !== "applied") return "Only applied changes can be undone";
  if ((target.kind ?? "set") !== "set") return "Undo and redo entries can't themselves be undone";
  if (target.sku !== adjustment.sku) return "SKU does not match the change being undone";

  const undoing = adjustment.kind === "undo";

  if (undoing && target.undone) return "That change has already been undone";
  if (!undoing && !target.undone) return "That change hasn't been undone, so there is nothing to redo";

  const targetDelta = target.newStock - target.previousStock;
  const expectedDelta = undoing ? -targetDelta : targetDelta;

  if (adjustment.newStock - adjustment.previousStock !== expectedDelta) {
    return "Stock difference does not match the change being undone";
  }

  return null;
}

export async function OPTIONS() {
  return new Response(null, { status: 200, headers: corsHeaders });
}

function reply(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: corsHeaders });
}

async function markAdjustment(
  id: string,
  status: "applied" | "rejected",
  fields: Record<string, unknown> = {}
) {
  try {
    await sanityClient
      .patch(id)
      .set({ status, resolvedAt: new Date().toISOString(), ...fields })
      .commit();
  } catch (error) {
    // The stock change (or refusal) already happened; a stale log entry is not
    // worth failing the request over.
    console.error(`[inventory-adjustment] Failed to mark ${id} as ${status}:`, error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { adjustmentId } = await req.json();

    if (typeof adjustmentId !== "string" || !adjustmentId || adjustmentId.startsWith("drafts.")) {
      return reply({ error: "A valid adjustmentId is required" }, 400);
    }

    const adjustment = await sanityClient.getDocument<InventoryAdjustment>(adjustmentId);

    if (!adjustment || (adjustment as { _type?: string })._type !== "inventoryAdjustment") {
      return reply({ error: "Adjustment not found" }, 404);
    }

    if (adjustment.status !== "pending") {
      return reply({ error: `Adjustment was already ${adjustment.status}` }, 409);
    }

    if (Date.now() - new Date(adjustment._createdAt).getTime() > MAX_ADJUSTMENT_AGE_MS) {
      await markAdjustment(adjustment._id, "rejected", { error: "Expired before it was applied" });
      return reply({ error: "Adjustment expired, please save again" }, 410);
    }

    const { sku, previousStock, newStock } = adjustment;

    if (!Number.isInteger(newStock) || newStock < 0 || !Number.isInteger(previousStock)) {
      await markAdjustment(adjustment._id, "rejected", { error: "Invalid stock value" });
      return reply({ error: "Stock must be a whole number of 0 or more" }, 400);
    }

    let target: InventoryAdjustment | null = null;

    if (adjustment.kind === "undo" || adjustment.kind === "redo") {
      target = adjustment.target?._ref
        ? ((await sanityClient.getDocument<InventoryAdjustment>(adjustment.target._ref)) ?? null)
        : null;

      const problem = undoRedoProblem(adjustment, target);

      if (problem) {
        await markAdjustment(adjustment._id, "rejected", { error: problem });
        return reply({ error: problem }, 409);
      }

      // Claim the target before touching stock so a double-click (or two
      // editors) can't undo the same change twice. The revision check makes
      // this fail if anyone else flipped it first.
      try {
        await sanityClient
          .patch(target!._id)
          .ifRevisionId(target!._rev)
          .set({ undone: adjustment.kind === "undo" })
          .commit();
      } catch {
        await markAdjustment(adjustment._id, "rejected", { error: "The change was modified at the same time" });
        return reply({ error: "That change was just undone or redone elsewhere. Refresh and try again." }, 409);
      }
    }

    // Only write if stock is still what the editor was looking at. If an order
    // came in since the Studio loaded, this matches nothing and the editor gets
    // the fresh number instead of silently erasing the sale.
    const { count } = await prismaWrite.productVariant.updateMany({
      where: { sku, stock: previousStock },
      data: { stock: newStock },
    });

    if (count === 0) {
      if (target) {
        // Give the claim back — the stock never moved
        await sanityClient
          .patch(target._id)
          .set({ undone: adjustment.kind !== "undo" })
          .commit()
          .catch((error) =>
            console.error(`[inventory-adjustment] Failed to release claim on ${target!._id}:`, error)
          );
      }

      const current = await prismaWrite.productVariant.findUnique({ where: { sku } });

      if (!current) {
        await markAdjustment(adjustment._id, "rejected", { error: "SKU not found in database" });
        return reply({ error: `SKU ${sku} not found in database` }, 404);
      }

      await markAdjustment(adjustment._id, "rejected", {
        error: `Stock changed to ${current.stock} before the save was applied`,
      });

      return reply(
        {
          error: "Stock changed since you loaded it (probably a new order). Review and save again.",
          currentStock: current.stock,
        },
        409
      );
    }

    await markAdjustment(adjustment._id, "applied");

    console.log(
      `[inventory-adjustment] ${adjustment.kind ?? "set"} ${sku}: ${previousStock} -> ${newStock} (adjustment ${adjustment._id})`
    );

    return reply({ success: true, sku, stock: newStock });
  } catch (error) {
    console.error("[inventory-adjustment] Error applying adjustment:", error);
    return reply(
      {
        error: "Failed to update inventory",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      500
    );
  }
}
