import Booking from "../models/Booking.js";
import Show from "../models/Show.js";
import User from "../models/User.js";

// Check the user is admin or not
export const isAdmin = async (req, res) => {
  console.log("👤 Checking admin status for user:", req.auth?.userId);
  console.log("🔐 User metadata:", req.auth);
  res.json({ success: true, isAdmin: true });
};

// API to get dashboard data
export const adminDashboarddata = async (req, res) => {
  console.log("📊 Fetching dashboard data...");
  try {
    console.log("💰 Fetching paid bookings...");
    const bookings = await Booking.find({ isPaid: true });
    console.log(`📈 Found ${bookings.length} paid bookings`);

    console.log("🎬 Fetching active shows...");
    const activeshows = await Show.find({
      showDateTime: { $gte: new Date() },
    }).populate("movie");
    console.log(`🎥 Found ${activeshows.length} active shows`);

    console.log("👥 Counting total users...");
    const totalUsers = await User.countDocuments();
    console.log(`👥 Total users: ${totalUsers}`);

    const totalRevenue = bookings.reduce(
      (acc, booking) => acc + booking.amount,
      0
    );
    console.log(`💵 Total revenue: ${totalRevenue}`);

    const dashboarddata = {
      totalUsers,
      totalRevenue,
      totalBookings: bookings.length,
      activeshows,
    };
    console.log("✅ Dashboard data compiled successfully");
    res.json({ success: true, dashboarddata });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};

// API to get all shows
export const getallshows = async (req, res) => {
  try {
    const showdata = await Show.find({ showDateTime: { $gte: new Date() } })
      .populate("movie")
      .sort({ showDateTime: 1 });
    res.json({ success: true, showdata });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};

export const getbookings = async (req, res) => {
  try {
    const bookings = await Booking.find({})
      .populate("user")
      .populate({
        path: "show",
        populate: {
          path: "movie",
        },
      })
      .sort({ createdAt: -1 });
    res.json({ success: true, bookings });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};
