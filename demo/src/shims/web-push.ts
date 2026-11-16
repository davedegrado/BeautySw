// Nella demo non c'è un server che invia notifiche push: restano le notifiche in-app.
const webpush = {
  generateVAPIDKeys: () => ({ publicKey: "demo", privateKey: "demo" }),
  setVapidDetails: () => {},
  sendNotification: async () => ({ statusCode: 201 }),
};
export default webpush;
