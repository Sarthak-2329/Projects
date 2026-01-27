import mongoose from "mongoose";

export const connectDB = async()=>{
    try {
        const {MONGO_URI} = process.env;
        if(!MONGO_URI) throw new Error("MONGO_URI is not set");
        const con = await mongoose.connect(process.env.MONGO_URI);
        console.log("MONGODB CONNECTED: ",con.connection.host);
    } catch (error) {
        console.error("Error: ",error);
        process.exit(1);
    }
};