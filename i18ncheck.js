var keys = ['eventCount', 'exportTitle', 'errorExport', 'importTitle', 'errorImport'];
var locales = ['en', 'fr', 'mn', 'ru', 'vi'];
var namespaces = ['teamCalendars', 'calendarResources'];
namespaces.forEach(function (ns) {
  console.log('=== domains.' + ns + ' ===');
  locales.forEach(function (loc) {
    var j = require('./src/i18n/locales/' + loc + '.json');
    var s = (j.domains && j.domains[ns]) || {};
    var missing = keys.filter(function (k) { return s[k] === undefined; });
    console.log('  ' + loc + ': ' + (missing.length ? 'MISSING ' + missing.join(',') : 'ok'));
  });
});
