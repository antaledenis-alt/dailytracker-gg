// Бесплатный Apple ID не поддерживает push-уведомления. Нам они и не нужны —
// все напоминания локальные. Убираем push-разрешение, чтобы подпись прошла без ошибок.
const { withEntitlementsPlist } = require('expo/config-plugins');

module.exports = function withNoPush(config) {
  return withEntitlementsPlist(config, (cfg) => {
    delete cfg.modResults['aps-environment'];
    return cfg;
  });
};
