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
     * 连接还没开启
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

//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImNvbW1vbi9SZWFkeVN0YXRlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQUE7Ozs7O0dBS0c7QUFDSCxJQUFZLFVBaUJYO0FBakJELFdBQVksVUFBVTtJQUNsQjs7T0FFRztJQUNILHVEQUFVLENBQUE7SUFDVjs7T0FFRztJQUNILDJDQUFJLENBQUE7SUFDSjs7T0FFRztJQUNILGlEQUFPLENBQUE7SUFDUDs7T0FFRztJQUNILCtDQUFNLENBQUE7QUFDVixDQUFDLEVBakJXLFVBQVUsR0FBVixrQkFBVSxLQUFWLGtCQUFVLFFBaUJyQiIsImZpbGUiOiJjb21tb24vUmVhZHlTdGF0ZS5qcyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxyXG4gKiDmj4/ov7AgV2ViU29ja2V0IOi/nuaOpeeahOeKtuaAgVxyXG4gKiBcclxuICogQGV4cG9ydFxyXG4gKiBAZW51bSB7bnVtYmVyfVxyXG4gKi9cclxuZXhwb3J0IGVudW0gUmVhZHlTdGF0ZSB7XHJcbiAgICAvKipcclxuICAgICAqIOi/nuaOpei/mOayoeW8gOWQr1xyXG4gICAgICovXHJcbiAgICBDT05ORUNUSU5HLFxyXG4gICAgLyoqXHJcbiAgICAgKiDov57mjqXlt7LlvIDlkK/lubblh4blpIflpb3ov5vooYzpgJrkv6FcclxuICAgICAqL1xyXG4gICAgT1BFTixcclxuICAgIC8qKlxyXG4gICAgICog6L+e5o6l5q2j5Zyo5YWz6Zet55qE6L+H56iL5LitXHJcbiAgICAgKi9cclxuICAgIENMT1NJTkcsXHJcbiAgICAvKipcclxuICAgICAqIOi/nuaOpeW3sue7j+WFs+mXre+8jOaIluiAhei/nuaOpeaXoOazleW7uueri1xyXG4gICAgICovXHJcbiAgICBDTE9TRURcclxufSJdfQ==
