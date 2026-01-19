  import mongoose, { Schema, Model } from "mongoose";
  import { IMessages } from "../interface/all_interface";

  const MessageSchema: Schema<IMessages> = new Schema(
    {
      sender: {
        type: Schema.Types.ObjectId,
        ref: "Users",
        required: true,
      },
      receiver: {
        type: Schema.Types.ObjectId,
        ref: "Users",
        required: true,
      },
      content: {
        type: String,
        required: true,
        trim: true,
      },
      isRead: {
        type: Boolean,
        default: false,
      },
    },
    {
      timestamps: true, // ✅ adds createdAt & updatedAt automatically
    }
  );

  const Messages: Model<IMessages> =
    mongoose.models.Messages ||
    mongoose.model<IMessages>("Messages", MessageSchema);

  export default Messages;
