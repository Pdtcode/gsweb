/* eslint-disable no-console */
"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import {
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  getIdToken,
} from "firebase/auth";

import { auth } from "@/lib/firebase";

interface Address {
  id: string;
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  isDefault: boolean;
}

interface DbUser {
  id: string;
  email: string;
  name: string | null;
  addresses?: Address[];
}

interface AuthContextType {
  user: User | null;
  dbUser: DbUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<User>;
  signUp: (email: string, password: string) => Promise<User>;
  logOut: () => Promise<void>;
  signInWithGoogle: () => Promise<User | null>;
  syncUser: (firebaseUser: User) => Promise<DbUser | null>;
  getUserAddresses: () => Promise<Address[]>;
  getDefaultAddress: () => Promise<Address | null>;
  saveAddress: (address: Omit<Address, "id">) => Promise<Address>;
  updateAddress: (id: string, address: Partial<Address>) => Promise<Address>;
  deleteAddress: (id: string) => Promise<boolean>;
  setDefaultAddress: (id: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [dbUser, setDbUser] = useState<DbUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [_addressesCache, setAddressesCache] = useState<Address[]>([]);

  // Helper function to detect mobile devices
  const isMobileDevice = () => {
    if (typeof window === "undefined") return false;
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    ) || window.innerWidth <= 768;
  };

  // Sync user with database
  const syncUser = async (firebaseUser: User): Promise<DbUser | null> => {
    try {
      if (!firebaseUser) return null;

      // Get Firebase ID token
      const token = await getIdToken(firebaseUser);

      // Call our API to create/update user in database
      const response = await fetch("/api/user", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        // Use safer logging method to prevent any issues
        const errorText = `Failed to sync user with database: ${response.status}`;

        console.warn(errorText);

        return null;
      }

      const dbUser = await response.json();

      return dbUser;
    } catch (error) {
      // Use safer logging method
      console.warn(
        "Error syncing user with database:",
        error instanceof Error ? error.message : String(error),
      );

      return null;
    }
  };

  useEffect(() => {
    // Check for redirect result on mount
    const handleRedirectResult = async () => {
      try {
        const result = await getRedirectResult(auth);
        if (result && result.user) {
          // Sync Google user with database after redirect
          await syncUser(result.user);
        }
      } catch (error) {
        console.warn("Redirect result error:", error);
      }
    };

    handleRedirectResult();

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);

      if (firebaseUser) {
        // If user is logged in, sync with database
        const syncedUser = await syncUser(firebaseUser);

        setDbUser(syncedUser);
      } else {
        setDbUser(null);
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const result = await signInWithEmailAndPassword(auth, email, password);

    return result.user;
  };

  const signUp = async (email: string, password: string) => {
    const result = await createUserWithEmailAndPassword(auth, email, password);

    // Sync new user with database
    await syncUser(result.user);

    return result.user;
  };

  const logOut = async () => {
    await signOut(auth);
  };

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    
    // Add additional scopes if needed
    provider.addScope('email');
    provider.addScope('profile');
    
    // Use redirect on mobile devices, popup on desktop
    if (isMobileDevice()) {
      // On mobile, use redirect to avoid popup blockers and storage issues
      await signInWithRedirect(auth, provider);
      // Note: The actual user will be available after redirect via getRedirectResult
      // The useEffect will handle the redirect result
      return null; // Return null since we don't have the user immediately
    } else {
      // On desktop, use popup
      try {
        const result = await signInWithPopup(auth, provider);
        
        // Sync Google user with database
        await syncUser(result.user);
        
        return result.user;
      } catch (error: any) {
        // If popup fails, fall back to redirect
        if (error.code === 'auth/popup-blocked' || error.code === 'auth/popup-closed-by-user') {
          await signInWithRedirect(auth, provider);
          return null;
        }
        throw error;
      }
    }
  };

  // Get user addresses
  const getUserAddresses = async (): Promise<Address[]> => {
    try {
      if (!user) {
        return [];
      }

      const token = await getIdToken(user);
      const response = await fetch("/api/user/addresses", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch addresses");
      }

      const addresses = await response.json();

      setAddressesCache(addresses);

      return addresses;
    } catch (error) {
      console.warn(
        "Error fetching addresses:",
        error instanceof Error ? error.message : String(error),
      );

      return [];
    }
  };

  // Get default address
  const getDefaultAddress = async (): Promise<Address | null> => {
    try {
      const addresses = await getUserAddresses();
      const defaultAddress = addresses.find((addr) => addr.isDefault);

      return defaultAddress || null;
    } catch (error) {
      console.warn(
        "Error getting default address:",
        error instanceof Error ? error.message : String(error),
      );

      return null;
    }
  };

  // Save a new address
  const saveAddress = async (
    address: Omit<Address, "id">,
  ): Promise<Address> => {
    try {
      if (!user) {
        throw new Error("User not authenticated");
      }

      const token = await getIdToken(user);
      const response = await fetch("/api/user/addresses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(address),
      });

      if (!response.ok) {
        throw new Error("Failed to save address");
      }

      const newAddress = await response.json();

      // Refresh the addresses cache
      getUserAddresses();

      return newAddress;
    } catch (error) {
      console.warn(
        "Error saving address:",
        error instanceof Error ? error.message : String(error),
      );
      throw error;
    }
  };

  // Update an address
  const updateAddress = async (
    id: string,
    address: Partial<Address>,
  ): Promise<Address> => {
    try {
      if (!user) {
        throw new Error("User not authenticated");
      }

      const token = await getIdToken(user);
      const response = await fetch(`/api/user/addresses/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(address),
      });

      if (!response.ok) {
        throw new Error("Failed to update address");
      }

      const updatedAddress = await response.json();

      // Refresh the addresses cache
      getUserAddresses();

      return updatedAddress;
    } catch (error) {
      console.warn(
        "Error updating address:",
        error instanceof Error ? error.message : String(error),
      );
      throw error;
    }
  };

  // Delete an address
  const deleteAddress = async (id: string): Promise<boolean> => {
    try {
      if (!user) {
        throw new Error("User not authenticated");
      }

      const token = await getIdToken(user);
      const response = await fetch(`/api/user/addresses/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to delete address");
      }

      // Refresh the addresses cache
      getUserAddresses();

      return true;
    } catch (error) {
      console.warn(
        "Error deleting address:",
        error instanceof Error ? error.message : String(error),
      );

      return false;
    }
  };

  // Set default address
  const setDefaultAddress = async (id: string): Promise<boolean> => {
    try {
      if (!user) {
        throw new Error("User not authenticated");
      }

      const token = await getIdToken(user);
      const response = await fetch(`/api/user/addresses/${id}/default`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to set default address");
      }

      // Refresh the addresses cache
      getUserAddresses();

      return true;
    } catch (error) {
      console.warn(
        "Error setting default address:",
        error instanceof Error ? error.message : String(error),
      );

      return false;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        dbUser,
        loading,
        signIn,
        signUp,
        logOut,
        signInWithGoogle,
        syncUser,
        getUserAddresses,
        getDefaultAddress,
        saveAddress,
        updateAddress,
        deleteAddress,
        setDefaultAddress,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
}
