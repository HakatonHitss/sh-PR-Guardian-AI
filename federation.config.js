const { withNativeFederation, shareAll } = require('@angular-architects/native-federation/config');

module.exports = withNativeFederation({
    name: 'sh-pr-guardian-ai',
    shared: {
        ...shareAll({ singleton: true, strictVersion: true, requiredVersion: 'auto' })
    },
    skip: [
        'rxjs/ajax',
        'rxjs/fetch',
        'rxjs/testing',
        'rxjs/webSocket',
        'oxc-parser',
        '@oxc-parser/binding-win32-x64-msvc'
    ]
});
