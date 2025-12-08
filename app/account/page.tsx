"use client";

import { useState, useEffect } from "react";
import Image from "next/image";

import { useAuth } from "@/context/AuthContext";

interface UserContact {
  id: string;
  email: string;
  name: string | null;
  phoneNumber: string | null;
  instagramHandle: string | null;
}

export default function AccountPage() {
  const { user } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [isEditingContact, setIsEditingContact] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [instagramHandle, setInstagramHandle] = useState("");
  const [userContactInfo, setUserContactInfo] = useState<UserContact | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName || "");
      fetchContactInfo();
    }
  }, [user]);

  const fetchContactInfo = async () => {
    if (!user?.uid) return;

    try {
      // First find the user by Firebase UID
      const userResponse = await fetch(`/api/user?firebaseUid=${user.uid}`);
      if (!userResponse.ok) return;

      const userData = await userResponse.json();
      if (!userData.success || !userData.user) return;

      // Then fetch contact info
      const contactResponse = await fetch(`/api/user/contact?userId=${userData.user.id}`);
      if (contactResponse.ok) {
        const contactData = await contactResponse.json();
        if (contactData.success) {
          setUserContactInfo(contactData.user);
          setPhoneNumber(contactData.user.phoneNumber || "");
          setInstagramHandle(contactData.user.instagramHandle || "");
        }
      }
    } catch (error) {
      console.error("Error fetching contact info:", error);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    // Note: This would require updating Firebase profile functionality
    // Currently we're just mocking the interface
    setIsEditing(false);
  };

  const handleUpdateContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userContactInfo?.id) return;

    setLoading(true);
    try {
      const response = await fetch("/api/user/contact", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: userContactInfo.id,
          phoneNumber: phoneNumber.trim() || null,
          instagramHandle: instagramHandle.trim() || null,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setUserContactInfo(data.user);
        setIsEditingContact(false);
        // You could add a toast notification here
      } else {
        console.error("Failed to update contact info:", data.message);
      }
    } catch (error) {
      console.error("Error updating contact info:", error);
    } finally {
      setLoading(false);
    }
  };

  // Default avatar if user doesn't have a photo URL
  const defaultAvatar = "/default-avatar.svg";

  // Get user's display name or email for display
  const userDisplayName =
    user?.displayName || user?.email?.split("@")[0] || "User";

  // Get user's photo URL or use default
  const photoURL = user?.photoURL || defaultAvatar;

  return (
    <div className="space-y-8">
      <div className="shadow rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-6">Account Information</h2>

      <div className="flex flex-col md:flex-row items-start md:items-center gap-6 mb-8">
        <div className="w-24 h-24 rounded-full overflow-hidden relative">
          <Image
            alt={userDisplayName}
            className="object-cover w-full h-full"
            height={96}
            src={photoURL}
            width={96}
          />
        </div>

        <div>
          <h3 className="text-lg font-medium">{userDisplayName}</h3>
          <p className="text-gray-600">{user?.email}</p>
          <p className="text-sm text-gray-500 mt-1">
            Account type:{" "}
            {user?.providerData[0]?.providerId === "google.com"
              ? "Google"
              : "Email"}
          </p>
        </div>
      </div>

      {isEditing ? (
        <form className="space-y-4" onSubmit={handleUpdateProfile}>
          <div>
            <label
              className="block text-sm font-medium text-gray-700"
              htmlFor="displayName"
            >
              Display Name
            </label>
            <input
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              id="displayName"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </div>

          <div className="flex gap-4">
            <button
              className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-black hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 dark:bg-white dark:text-black dark:hover:bg-gray-100 dark:focus:ring-white"
              type="submit"
            >
              Save Changes
            </button>
            <button
              className="inline-flex justify-center py-2 px-4 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-black bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 dark:border-gray-600 dark:text-white dark:bg-black dark:hover:bg-gray-800 dark:focus:ring-white"
              type="button"
              onClick={() => setIsEditing(false)}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button
          className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-black hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 dark:bg-white dark:text-black dark:hover:bg-gray-100 dark:focus:ring-white"
          onClick={() => setIsEditing(true)}
        >
          Edit Profile
        </button>
      )}
      </div>

      {/* Contact Information Section */}
      <div className="shadow rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-6">Contact Information</h2>

        {isEditingContact ? (
          <form className="space-y-4" onSubmit={handleUpdateContact}>
            <div>
              <label
                className="block text-sm font-medium text-gray-700"
                htmlFor="phoneNumber"
              >
                Phone Number
              </label>
              <input
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                id="phoneNumber"
                type="tel"
                placeholder="+1 (555) 123-4567"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
              />
            </div>

            <div>
              <label
                className="block text-sm font-medium text-gray-700"
                htmlFor="instagramHandle"
              >
                Instagram Handle
              </label>
              <div className="mt-1 flex rounded-md shadow-sm">
                <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-gray-300 bg-gray-50 text-gray-500 text-sm">
                  @
                </span>
                <input
                  className="flex-1 block w-full rounded-none rounded-r-md border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  id="instagramHandle"
                  type="text"
                  placeholder="your_handle"
                  value={instagramHandle}
                  onChange={(e) => setInstagramHandle(e.target.value)}
                />
              </div>
            </div>

            <div className="flex gap-4">
              <button
                className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-black hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 dark:bg-white dark:text-black dark:hover:bg-gray-100 dark:focus:ring-white disabled:opacity-50"
                type="submit"
                disabled={loading}
              >
                {loading ? "Saving..." : "Save Contact Info"}
              </button>
              <button
                className="inline-flex justify-center py-2 px-4 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-black bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 dark:border-gray-600 dark:text-white dark:bg-black dark:hover:bg-gray-800 dark:focus:ring-white"
                type="button"
                onClick={() => {
                  setIsEditingContact(false);
                  setPhoneNumber(userContactInfo?.phoneNumber || "");
                  setInstagramHandle(userContactInfo?.instagramHandle || "");
                }}
                disabled={loading}
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <div>
              <span className="block text-sm font-medium text-gray-700">
                Phone Number
              </span>
              <p className="mt-1 text-sm text-gray-900">
                {userContactInfo?.phoneNumber || "Not provided"}
              </p>
            </div>

            <div>
              <span className="block text-sm font-medium text-gray-700">
                Instagram Handle
              </span>
              <p className="mt-1 text-sm text-gray-900">
                {userContactInfo?.instagramHandle
                  ? `@${userContactInfo.instagramHandle}`
                  : "Not provided"}
              </p>
            </div>

            <button
              className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-black hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 dark:bg-white dark:text-black dark:hover:bg-gray-100 dark:focus:ring-white"
              onClick={() => setIsEditingContact(true)}
            >
              Edit Contact Info
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
