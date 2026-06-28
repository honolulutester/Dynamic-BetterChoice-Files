import('./app.js').then(() => {
    console.log("Success!");
}).catch(err => {
    console.error("IMPORT ERROR:", err);
});
