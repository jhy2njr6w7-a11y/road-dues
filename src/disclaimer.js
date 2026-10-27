// Lets any part of the app open the disclaimer sheet (rendered once in App.js).
// opts: { afterPay: bool, onContinue: fn }
let opener = () => {};
export const setDisclaimerOpener = (fn) => { opener = fn; };
export const openDisclaimer = (opts = {}) => opener(opts);
