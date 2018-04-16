"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * 描述 WebSocket 连接的状态
 *
 * @export
 * @enum {number}
 */
var ReadyState;
(function (ReadyState) {
    /**
     * 正在连接
     */
    ReadyState[ReadyState["CONNECTING"] = 0] = "CONNECTING";
    /**
     * 连接已开启并准备好进行通信
     */
    ReadyState[ReadyState["OPEN"] = 1] = "OPEN";
    /**
     * 连接正在关闭的过程中
     */
    ReadyState[ReadyState["CLOSING"] = 2] = "CLOSING";
    /**
     * 连接已经关闭，或者连接无法建立
     */
    ReadyState[ReadyState["CLOSED"] = 3] = "CLOSED";
})(ReadyState = exports.ReadyState || (exports.ReadyState = {}));

//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIkJhc2VTb2NrZXQvaW50ZXJmYWNlcy9SZWFkeVN0YXRlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQUE7Ozs7O0dBS0c7QUFDSCxJQUFZLFVBb0JYO0FBcEJELFdBQVksVUFBVTtJQUNsQjs7T0FFRztJQUNILHVEQUFVLENBQUE7SUFFVjs7T0FFRztJQUNILDJDQUFJLENBQUE7SUFFSjs7T0FFRztJQUNILGlEQUFPLENBQUE7SUFFUDs7T0FFRztJQUNILCtDQUFNLENBQUE7QUFDVixDQUFDLEVBcEJXLFVBQVUsR0FBVixrQkFBVSxLQUFWLGtCQUFVLFFBb0JyQiIsImZpbGUiOiJCYXNlU29ja2V0L2ludGVyZmFjZXMvUmVhZHlTdGF0ZS5qcyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxyXG4gKiDmj4/ov7AgV2ViU29ja2V0IOi/nuaOpeeahOeKtuaAgVxyXG4gKiBcclxuICogQGV4cG9ydFxyXG4gKiBAZW51bSB7bnVtYmVyfVxyXG4gKi9cclxuZXhwb3J0IGVudW0gUmVhZHlTdGF0ZSB7XHJcbiAgICAvKipcclxuICAgICAqIOato+WcqOi/nuaOpVxyXG4gICAgICovXHJcbiAgICBDT05ORUNUSU5HLFxyXG5cclxuICAgIC8qKlxyXG4gICAgICog6L+e5o6l5bey5byA5ZCv5bm25YeG5aSH5aW96L+b6KGM6YCa5L+hXHJcbiAgICAgKi9cclxuICAgIE9QRU4sXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiDov57mjqXmraPlnKjlhbPpl63nmoTov4fnqIvkuK1cclxuICAgICAqL1xyXG4gICAgQ0xPU0lORyxcclxuICAgIFxyXG4gICAgLyoqXHJcbiAgICAgKiDov57mjqXlt7Lnu4/lhbPpl63vvIzmiJbogIXov57mjqXml6Dms5Xlu7rnq4tcclxuICAgICAqL1xyXG4gICAgQ0xPU0VEXHJcbn0iXX0=
