Lampa.Utils.putScriptAsync(['https://krutoyrm.github.io/probe.js'], function(){});
/* Independent SISI bootstrap for Lampa; upstream: https://bylampa.github.io/sisi.js
 * Uses the upstream server-selection API, without restricting Manifest.origin.
 * Does not change Lampa settings or the downloaded plugin's behavior.
 */
(function () {
    'use strict';

    var flag = 'tester_sisi_loader';
    if (window[flag]) return;
    window[flag] = true;

    var endpoint = 'http://185.87.48.42:8095/random_sisi';
    var finished = false;
    var request;

    function fail(message) {
        if (finished) return;
        finished = true;
        window[flag] = false;
        Lampa.Noty.show(message);
    }

    function receive(text) {
        if (finished) return;
        var url = String(text || '').replace(/^\s+|\s+$/g, '');
        if (!/^https?:\/\/[^\s<>"']+$/i.test(url)) {
            fail('Не удалось получить адрес сервера');
            return;
        }
        finished = true;
        try {
            Lampa.Utils.putScriptAsync([url], function () {});
        } catch (error) {
            window[flag] = false;
            Lampa.Noty.show('Не удалось загрузить плагин SISI');
        }
    }

    Lampa.Platform.tv();

    // Native transport supports HTTP endpoints in Android Lampa on HTTPS pages.
    // Older builds fall back to the same XMLHttpRequest used by upstream.
    if (typeof Lampa.Reguest === 'function') {
        try {
            request = new Lampa.Reguest();
            request.timeout(15000);
            request.native(endpoint, receive, function () {
                fail('Не удалось получить адрес сервера SISI');
            }, false, {dataType: 'text'});
        } catch (error) {
            fail('Ошибка соединения с API SISI');
        }
    } else {
        request = new XMLHttpRequest();
        request.open('GET', endpoint, true);
        request.timeout = 15000;
        request.onreadystatechange = function () {
            if (request.readyState !== 4) return;
            if (request.status === 200) receive(request.responseText);
            else fail('Не удалось получить адрес сервера SISI (HTTP ' + request.status + ')');
        };
        request.onerror = request.ontimeout = function () {
            fail('Ошибка соединения с API SISI');
        };
        request.send();
    }
}());
