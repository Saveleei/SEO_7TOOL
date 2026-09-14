module.exports = {
  apps: [
    {
      name: "7tool-storefront-test",
      cwd: __dirname,
      script: "node_modules/vinext/dist/cli.js",
      args: "start",
      interpreter: "node",
      env: {
        NODE_ENV: "production",
        PORT: "3000",
        QUOTE_TEST_MODE: "1",
        QUOTE_TEST_DATA_DIR: "/var/www/7tool-test-shared/quote-requests",
        MANAGER_AUTH_TEST_HOSTS: "test.7tool.ru",
        FORCE_DOCUMENT_NAVIGATION: "1",
        SHIPPING_TIME_ZONE: "Europe/Moscow",
        SHIPPING_CUTOFF_HOUR: "18",
        SHIPPING_WORKING_DAYS: "1,2,3,4,5",
        SHIPPING_TODAY_ENABLED: "1",
        SHIPPING_FEED_MAX_AGE_MINUTES: "180",
      },
    },
  ],
};
