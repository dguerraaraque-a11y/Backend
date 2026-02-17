const { app } = require('./middleware.js');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    // This log is more generic for deployment environments
    console.log(`Server listening on port ${PORT}`);
});