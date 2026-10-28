// Web preview only: browsers can't send SMS, so pretend the message was sent and the user confirmed it.
// This lets the demo show what happens after paying (ticket card, countdown).
export const isAvailableAsync = async () => true;
export const sendSMSAsync = async () => ({ result: 'sent' });
