-- Retire a product from the storefront without deleting it.
--
-- Mirrors the `isActive` toggle on the Sanity product document. Defaults to
-- true so every existing row stays live; Postgres adds a column with a
-- non-volatile default in place, so this does not rewrite the table.

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;
