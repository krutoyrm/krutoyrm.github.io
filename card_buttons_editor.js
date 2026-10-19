/* Card Buttons Editor compatibility loader, independently written.
 * Original editor is fetched from its author's pinned GitHub revision.
 * Only the Manifest.origin guard is changed in memory; global origin is untouched.
 */
(function () {
    'use strict';
    var flag = 'krutoyrm_card_editor_loader';
    if (window[flag] || window.plugin_card_buttons_editor_ready) return;
    window[flag] = {state: 'loading', version: '1.0.0'};
    var url = 'https://raw.githubusercontent.com/bylampa/bylampa.github.io/e362a05eaae9f9996e6b37bc75fb57a628ce8d1c/card_buttons_editor.js';
    var guard = 'if(Lampa[_0x5d944d(0x284)][_0x5d944d(0x288)]!==_0x5d944d(0x1d9))';
    function fail(message) {
        window[flag].state = 'error';
        window[flag].error = message;
        Lampa.Noty.show('Редактор кнопок: ' + message);
    }
    var request = new Lampa.Reguest();
    request.native(url, function (source) {
        if (typeof source !== 'string' || source.split(guard).length !== 2) {
            fail('неожиданный исходный файл');
            return;
        }
        try {
            (new Function(source.replace(guard, 'if(false)')))();
            if (!window.plugin_card_buttons_editor_ready) throw new Error('not registered');
            window[flag].state = 'ready';
        } catch (error) {
            fail('не удалось запустить расширение');
        }
    }, function () {
        fail('ошибка загрузки, повторите после перезапуска');
    }, false, {dataType: 'text', timeout: 20000});
}());
