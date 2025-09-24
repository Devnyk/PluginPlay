import { clerkClient } from "@clerk/express";

export const protectAdmin = async(req, res, next) => {
    try {
        const { userId } = req.auth();
        
        if (!userId) {
            return res.status(401).json({ success: false, message: "Not Authorized" });
        }
        
        const user = await clerkClient.users.getUser(userId);
        
        if (user.privateMetadata?.role !== 'admin') {
            return res.status(403).json({ success: false, message: "Not Authorized" });
        }
        
        next(); // Only call next() if user is admin
    } catch (error) {
        return res.status(401).json({ success: false, message: "Not Authorized" });
    }
}