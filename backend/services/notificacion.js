// services/notification.service.js
const admin = require("firebase-admin");

exports.enviarNotificacion = async (token, title, body) => {
  try {
    await admin.messaging().send({
      token,
      notification: { title, body }
    });
  } catch (error) {
    console.error("Error notificando:", error.message);
  }
};