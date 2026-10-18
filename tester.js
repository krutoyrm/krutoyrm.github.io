Lampa.Utils.putScriptAsync(['https://krutoyrm.github.io/probe.js?v=2'], function(){});
/* Independent SISI bootstrap for Lampa; upstream: https://bylampa.github.io/sisi.js
 * Uses the upstream server-selection API, without restricting Manifest.origin.
 * Keeps Lampa settings unchanged; adds an HTTPS fallback for failed SISI thumbnails.
 */
(function () {
    'use strict';
    if (typeof document === 'undefined' || window.tester_sisi_images) return;
    window.tester_sisi_images = true;
    var style = document.createElement('style');
    style.id = 'tester-sisi-image-style';
    style.textContent = '.tester-sisi-card .card__title{white-space:normal!important;display:-webkit-box!important;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden!important;overflow-wrap:anywhere;max-height:2.8em}.tester-sisi-card .card__view{overflow:hidden}';
    (document.head || document.documentElement).appendChild(style);
    document.addEventListener('error', function (event) {
        var img = event.target;
        if (!img || img.tagName !== 'IMG' || !img.closest) return;
        var src = img.getAttribute('src') || '';
        // Only public, original HTTP SISI image proxies; never arbitrary image failures.
        if (!/^http:\/\/(?:178\.20\.|185\.87\.)\d{1,3}\.\d{1,3}:9118\/proxyimg\/[^\s<>"']+$/i.test(src)) return;
        var card = img.closest('.card');
        if (!card) return;
        event.stopImmediatePropagation();
        card.classList.add('tester-sisi-card');
        img.alt = '';
        // The image works without account query parameters: do not disclose them.
        var publicImage = src.split(/[?#]/)[0];
        img.src = 'https://images.weserv.nl/?url=' + encodeURIComponent(publicImage);
    }, true);
}());
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
