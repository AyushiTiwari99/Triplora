const express = require("express");
const router = express.Router();
const wrapAsync = require("../utils/wrapAsync.js");
const { listingSchema }= require("../schema.js");
const {isLoggedIn, isOwner, validateListing} = require("../middleware.js");
const Listing = require("../models/listing.js"); // ✅ ADD THIS LINE
const listingController = require("../controllers/listings.js");
const multer = require('multer');
const {storage} = require("../cloudConfig.js");
const upload = multer({ storage });

router
.route("/")
.get(wrapAsync(listingController.index))
.post(
    isLoggedIn,
    //upload.single('listing[image]'),
    upload.single("image"),

    validateListing,
    wrapAsync(listingController.createListing)
);

//New Route
router.get("/new",isLoggedIn, listingController.renderNewForm);


router
.route("/:id")
.get( wrapAsync(listingController.showListing))
.put(
  isLoggedIn,
  isOwner,
  //upload.single("listing[image]"),
  upload.single("images"),
  validateListing,
  wrapAsync (listingController.updateListing)
)
.delete(isLoggedIn, isOwner, wrapAsync (listingController.destroyListing));


//Edit Route
router.get("/:id/edit", isLoggedIn, isOwner, wrapAsync(listingController.renderEditForm)
);

// Booking routes
const bookingController = require("../controllers/bookings.js");
router.post("/:id/book", isLoggedIn, wrapAsync(bookingController.createOrder));
router.post("/:id/book/verify", isLoggedIn, wrapAsync(bookingController.verifyPayment));

module.exports = router;