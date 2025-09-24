import { clerkClient } from "@clerk/express";

export const protectAdmin = async (req, res, next) => {
  console.log("🔒 Checking admin authorization...");
  console.log("Headers:", req.headers);

  try {
    console.log("🔍 Attempting to get userId from auth...");
    const { userId } = req.auth();
    console.log("👤 UserId:", userId);

    if (!userId) {
      console.log("❌ No userId found in request");
      return res
        .status(401)
        .json({ success: false, message: "Not Authorized - No User ID" });
    }

    console.log("🔍 Fetching user details from Clerk...");
    const user = await clerkClient.users.getUser(userId);
    console.log("👤 User metadata:", user.privateMetadata);

    if (user.privateMetadata?.role !== "admin") {
      console.log("❌ User is not an admin. Role:", user.privateMetadata?.role);
      return res
        .status(403)
        .json({ success: false, message: "Not Authorized - Not Admin" });
    }

    console.log("✅ Admin authorization successful");
    next();
  } catch (error) {
    console.error("❌ Auth error:", error);
    return res
      .status(401)
      .json({
        success: false,
        message: "Authorization Error: " + error.message,
      });
  }
};
