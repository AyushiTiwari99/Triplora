if (process.env.NODE_ENV != "production") {
  require('dotenv').config();
}

const mongoose = require("mongoose");
const initData = require("./data.js");
const Listing = require("../models/listing.js");
const User = require("../models/user.js");

const dbUrl = process.env.ATLASDB_URL;

main()
  .then(async () => {
    console.log("connected to DB");
    await initDB();
    mongoose.connection.close();
  })
  .catch((err) => {
    console.log(err);
  });

async function main() {
  await mongoose.connect(dbUrl);
}

const initDB = async () => {
  await Listing.deleteMany({});
  
  let adminUser = await User.findOne({ username: "triplora_admin" });
  if (!adminUser) {
    const newUser = new User({ email: "admin@triplora.dev", username: "triplora_admin" });
    const randomPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).toUpperCase().slice(-8);
    adminUser = await User.register(newUser, randomPassword);
  }

  initData.data = initData.data.map((obj) => ({ ...obj, owner: adminUser._id }));
  await Listing.insertMany(initData.data);
  console.log("data was initialized");
};