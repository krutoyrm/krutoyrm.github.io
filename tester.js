/* Independent fixed-server SISI loader. Does not modify tester.js or Lampa settings. */
(function () {
    'use strict';
    var flag = 'sisi_fixed_109_172_86_65';
    if (window[flag]) return;
    window[flag] = true;
    function start() {
        try {
            Lampa.Platform.tv();
            Lampa.Utils.putScriptAsync(['http://150.241.116.154/sisi.js'], function () {});
        } catch (error) {
            window[flag] = false;
            Lampa.Noty.show('Не удалось загрузить SISI с 109.172.86.65');
        }
    }
    if (window.appready) start();
    else Lampa.Listener.follow('app', function (event) {
        if (event.type === 'ready' && !window[flag + '_ready']) {
            window[flag + '_ready'] = true;
            start();
        }
    });
}());
