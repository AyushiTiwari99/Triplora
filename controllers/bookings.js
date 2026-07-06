const Booking = require("../models/booking");
const Listing = require("../models/listing");
const Razorpay = require("razorpay");
const crypto = require("crypto");

// Helper function to get Razorpay instance lazily
function getRazorpayInstance() {
  const key_id = process.env.RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;
  
  if (!key_id || !key_secret) {
    throw new Error("Razorpay credentials are not configured in environment variables.");
  }
  
  return new Razorpay({
    key_id,
    key_secret,
  });
}

module.exports.createOrder = async (req, res, next) => {
  try {
    const { id } = req.params; // listingId
    const { checkIn, checkOut } = req.body;
    
    if (!checkIn || !checkOut) {
      return res.status(400).json({ success: false, message: "Check-in and check-out dates are required." });
    }
    
    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);
    
    if (checkOutDate <= checkInDate) {
      return res.status(400).json({ success: false, message: "Check-out date must be after check-in date." });
    }
    
    const listing = await Listing.findById(id);
    if (!listing) {
      return res.status(404).json({ success: false, message: "Listing not found." });
    }
    
    // Calculate number of nights
    const timeDiff = checkOutDate.getTime() - checkInDate.getTime();
    const nights = Math.ceil(timeDiff / (1000 * 3600 * 24));
    
    if (nights <= 0) {
      return res.status(400).json({ success: false, message: "Booking must be at least 1 night." });
    }
    
    const totalPrice = nights * listing.price;
    const amountInPaise = totalPrice * 100;
    
    const options = {
      amount: amountInPaise,
      currency: "INR",
      receipt: `receipt_booking_${Date.now()}`
    };
    
    const razorpay = getRazorpayInstance();
    const order = await razorpay.orders.create(options);
    
    const newBooking = new Booking({
      listing: listing._id,
      user: req.user._id,
      checkIn: checkInDate,
      checkOut: checkOutDate,
      totalPrice: totalPrice,
      razorpayOrderId: order.id,
      paymentStatus: "pending"
    });
    
    await newBooking.save();
    
    res.json({
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID
    });
    
  } catch (error) {
    console.error("Error creating order:", error);
    res.status(500).json({ success: false, message: "Internal server error." });
  }
};

module.exports.verifyPayment = async (req, res, next) => {
  try {
    const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body;
    
    if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
      return res.status(400).json({ success: false, message: "Missing payment verification parameters." });
    }
    
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest("hex");
      
    const isSignatureValid = expectedSignature === razorpay_signature;
    
    const booking = await Booking.findOne({ razorpayOrderId: razorpay_order_id });
    if (!booking) {
      return res.status(404).json({ success: false, message: "Booking not found for the given order." });
    }
    
    if (isSignatureValid) {
      booking.paymentStatus = "paid";
      booking.razorpayPaymentId = razorpay_payment_id;
      await booking.save();
      
      req.flash("success", "Booking and Payment successful!");
      res.json({ success: true });
    } else {
      booking.paymentStatus = "failed";
      await booking.save();
      
      req.flash("error", "Payment verification failed.");
      res.status(400).json({ success: false, message: "Invalid payment signature." });
    }
  } catch (error) {
    console.error("Error verifying signature:", error);
    res.status(500).json({ success: false, message: "Internal server error." });
  }
};
