'use strict';

const app = require('./src/app');
const env = require('./src/config/env');
const logger = require('./src/config/logger');

const port = env.PORT;

app.listen(port, () => {
    logger.info(`CrimeLens BE server running on port ${port}`, { env: env.NODE_ENV });
});
