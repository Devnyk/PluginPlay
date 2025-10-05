import { clerkClient } from "@clerk/express";

export const protectAdmin = async (req, res, next) => {
  console.log("🔒 Checking admin authorization...");
  console.log("Headers:", req.headers);

  try {
    console.log("🔍 Attempting to extract userId from req.auth...");

    let userId;
    try {
      if (typeof req.auth === "function") {
        const authResult = req.auth();
        userId = authResult?.userId || authResult?.user?.id || authResult?.sub;
      } else if (req.auth && typeof req.auth === "object") {
        userId = req.auth.userId || req.auth.user?.id || req.auth.sub;
      }
    } catch (e) {
      console.warn("⚠️ req.auth() threw an error:", e.message || e);
    }

    console.log("👤 Extracted userId:", userId);

    if (!userId) {
      console.log("❌ No userId found in request");
      return res
        .status(401)
        .json({ success: false, message: "Not Authorized - No User ID" });
    }

    console.log("🔍 Fetching user details from Clerk for id:", userId);
    const user = await clerkClient.users.getUser(userId);
    console.log("👤 Clerk user (public/private/unsafe):", {
      public: user?.publicMetadata,
      private: user?.privateMetadata,
      unsafe: user?.unsafeMetadata,
    });

    const foundRole =
      user?.privateMetadata?.role ||
      user?.publicMetadata?.role ||
      user?.unsafeMetadata?.role;

    console.log("🔎 Resolved role:", foundRole);

    if (foundRole !== "admin") {
      console.log("❌ User is not an admin. Role:", foundRole);
      return res
        .status(403)
        .json({ success: false, message: "Not Authorized - Not Admin" });
    }

    console.log("✅ Admin authorization successful");
    next();
  } catch (error) {
    console.error("❌ Auth error:", error);
    return res.status(401).json({
      success: false,
      message: "Authorization Error: " + (error?.message || error),
    });
  }
};
