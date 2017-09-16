"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const WS = require("ws");
const BaseSocket_1 = require("../common/BaseSocket");
class Socket extends BaseSocket_1.BaseSocket {
    constructor(args) {
        const cf = { url: '' };
        let socket;
        if (typeof args === 'string') {
            cf.url = args;
        }
        else if (typeof args === 'object') {
            Object.assign(cf, args);
        }
        if (!(cf.socket instanceof WS))
            cf.socket = new WS(cf.url, cf);
        (cf.socket).on('open', () => this.emit('open'));
        (cf.socket).on('close', (code, reason) => this.emit('close', code, reason));
        (cf.socket).on('error', (err) => this.emit('error', err));
        (cf.socket).on('message', (data) => this._receiveData(data));
        super('node', cf);
        this.id = Socket._id_Number++;
    }
    _sendData(data) {
        return new Promise((resolve, reject) => {
            this.socket.send(data, { binary: true }, (err) => {
                err ? reject(err) : resolve();
            });
        });
    }
    close() {
        this.socket.close();
    }
}
/**
 * 每新建一个接口+1
 *
 * @private
 * @static
 * @memberof Socket
 */
Socket._id_Number = 0;
exports.Socket = Socket;

//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInNlcnZlci9Tb2NrZXQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFBQSx5QkFBeUI7QUFHekIscURBQWtEO0FBR2xELFlBQW9CLFNBQVEsdUJBQVU7SUE0QmxDLFlBQVksSUFBUztRQUNqQixNQUFNLEVBQUUsR0FBdUIsRUFBRSxHQUFHLEVBQUUsRUFBRSxFQUFFLENBQUM7UUFDM0MsSUFBSSxNQUFVLENBQUM7UUFFZixFQUFFLENBQUMsQ0FBQyxPQUFPLElBQUksS0FBSyxRQUFRLENBQUMsQ0FBQyxDQUFDO1lBQzNCLEVBQUUsQ0FBQyxHQUFHLEdBQUcsSUFBSSxDQUFDO1FBQ2xCLENBQUM7UUFBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUMsT0FBTyxJQUFJLEtBQUssUUFBUSxDQUFDLENBQUMsQ0FBQztZQUNsQyxNQUFNLENBQUMsTUFBTSxDQUFDLEVBQUUsRUFBRSxJQUFJLENBQUMsQ0FBQztRQUM1QixDQUFDO1FBRUQsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxNQUFNLFlBQVksRUFBRSxDQUFDLENBQUM7WUFDM0IsRUFBRSxDQUFDLE1BQU0sR0FBRyxJQUFJLEVBQUUsQ0FBQyxFQUFFLENBQUMsR0FBRyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1FBRTlCLENBQUMsRUFBRSxDQUFDLE1BQU0sQ0FBRSxDQUFDLEVBQUUsQ0FBQyxNQUFNLEVBQUUsTUFBTSxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUM7UUFDakQsQ0FBQyxFQUFFLENBQUMsTUFBTSxDQUFFLENBQUMsRUFBRSxDQUFDLE9BQU8sRUFBRSxDQUFDLElBQVksRUFBRSxNQUFjLEtBQUssSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsSUFBSSxFQUFFLE1BQU0sQ0FBQyxDQUFDLENBQUM7UUFDN0YsQ0FBQyxFQUFFLENBQUMsTUFBTSxDQUFFLENBQUMsRUFBRSxDQUFDLE9BQU8sRUFBRSxDQUFDLEdBQUcsS0FBSyxJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxHQUFHLENBQUMsQ0FBQyxDQUFDO1FBQzNELENBQUMsRUFBRSxDQUFDLE1BQU0sQ0FBRSxDQUFDLEVBQUUsQ0FBQyxTQUFTLEVBQUUsQ0FBQyxJQUFZLEtBQUssSUFBSSxDQUFDLFlBQVksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO1FBRTNFLEtBQUssQ0FBQyxNQUFNLEVBQUUsRUFBRSxDQUFDLENBQUM7UUFDbEIsSUFBSSxDQUFDLEVBQUUsR0FBRyxNQUFNLENBQUMsVUFBVSxFQUFFLENBQUM7SUFDbEMsQ0FBQztJQUVTLFNBQVMsQ0FBQyxJQUFZO1FBQzVCLE1BQU0sQ0FBQyxJQUFJLE9BQU8sQ0FBQyxDQUFDLE9BQU8sRUFBRSxNQUFNO1lBQy9CLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxFQUFFLE1BQU0sRUFBRSxJQUFJLEVBQUUsRUFBRSxDQUFDLEdBQUc7Z0JBQ3pDLEdBQUcsR0FBRyxNQUFNLENBQUMsR0FBRyxDQUFDLEdBQUcsT0FBTyxFQUFFLENBQUM7WUFDbEMsQ0FBQyxDQUFDLENBQUM7UUFDUCxDQUFDLENBQUMsQ0FBQztJQUNQLENBQUM7SUFFRCxLQUFLO1FBQ0QsSUFBSSxDQUFDLE1BQU0sQ0FBQyxLQUFLLEVBQUUsQ0FBQztJQUN4QixDQUFDOztBQTFERDs7Ozs7O0dBTUc7QUFDWSxpQkFBVSxHQUFHLENBQUMsQ0FBQztBQVRsQyx3QkE2REMiLCJmaWxlIjoic2VydmVyL1NvY2tldC5qcyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIFdTIGZyb20gJ3dzJztcclxuXHJcbmltcG9ydCB7IFNlcnZlclNvY2tldENvbmZpZyB9IGZyb20gJy4vU2VydmVyU29ja2V0Q29uZmlnJztcclxuaW1wb3J0IHsgQmFzZVNvY2tldCB9IGZyb20gXCIuLi9jb21tb24vQmFzZVNvY2tldFwiO1xyXG5pbXBvcnQgeyBSZWFkeVN0YXRlIH0gZnJvbSBcIi4uL2NvbW1vbi9SZWFkeVN0YXRlXCI7XHJcblxyXG5leHBvcnQgY2xhc3MgU29ja2V0IGV4dGVuZHMgQmFzZVNvY2tldCB7XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiDmr4/mlrDlu7rkuIDkuKrmjqXlj6MrMVxyXG4gICAgICogXHJcbiAgICAgKiBAcHJpdmF0ZVxyXG4gICAgICogQHN0YXRpY1xyXG4gICAgICogQG1lbWJlcm9mIFNvY2tldFxyXG4gICAgICovXHJcbiAgICBwcml2YXRlIHN0YXRpYyBfaWRfTnVtYmVyID0gMDtcclxuXHJcbiAgICAvKipcclxuICAgICAqIOW9k+WJjeaOpeWPo+eahGlkXHJcbiAgICAgKiBcclxuICAgICAqIEBtZW1iZXJvZiBTb2NrZXRcclxuICAgICAqL1xyXG4gICAgcmVhZG9ubHkgaWQ6IG51bWJlcjtcclxuXHJcbiAgICByZWFkb25seSBzb2NrZXQ6IFdTO1xyXG5cclxuICAgIC8qKlxyXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IHVybCDmnI3liqHlmajlnLDlnYBcclxuICAgICAqL1xyXG4gICAgY29uc3RydWN0b3IodXJsOiBzdHJpbmcpXHJcbiAgICAvKipcclxuICAgICAqIEBwYXJhbSBjb25maWdzIOerr+WPo+eahOmFjee9rlxyXG4gICAgICovXHJcbiAgICBjb25zdHJ1Y3Rvcihjb25maWdzOiBTZXJ2ZXJTb2NrZXRDb25maWcpXHJcbiAgICBjb25zdHJ1Y3RvcihhcmdzOiBhbnkpIHtcclxuICAgICAgICBjb25zdCBjZjogU2VydmVyU29ja2V0Q29uZmlnID0geyB1cmw6ICcnIH07XHJcbiAgICAgICAgbGV0IHNvY2tldDogV1M7XHJcblxyXG4gICAgICAgIGlmICh0eXBlb2YgYXJncyA9PT0gJ3N0cmluZycpIHtcclxuICAgICAgICAgICAgY2YudXJsID0gYXJncztcclxuICAgICAgICB9IGVsc2UgaWYgKHR5cGVvZiBhcmdzID09PSAnb2JqZWN0Jykge1xyXG4gICAgICAgICAgICBPYmplY3QuYXNzaWduKGNmLCBhcmdzKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGlmICghKGNmLnNvY2tldCBpbnN0YW5jZW9mIFdTKSlcclxuICAgICAgICAgICAgY2Yuc29ja2V0ID0gbmV3IFdTKGNmLnVybCwgY2YpO1xyXG5cclxuICAgICAgICAoPFdTPihjZi5zb2NrZXQpKS5vbignb3BlbicsICgpID0+IHRoaXMuZW1pdCgnb3BlbicpKTtcclxuICAgICAgICAoPFdTPihjZi5zb2NrZXQpKS5vbignY2xvc2UnLCAoY29kZTogbnVtYmVyLCByZWFzb246IHN0cmluZykgPT4gdGhpcy5lbWl0KCdjbG9zZScsIGNvZGUsIHJlYXNvbikpO1xyXG4gICAgICAgICg8V1M+KGNmLnNvY2tldCkpLm9uKCdlcnJvcicsIChlcnIpID0+IHRoaXMuZW1pdCgnZXJyb3InLCBlcnIpKTtcclxuICAgICAgICAoPFdTPihjZi5zb2NrZXQpKS5vbignbWVzc2FnZScsIChkYXRhOiBCdWZmZXIpID0+IHRoaXMuX3JlY2VpdmVEYXRhKGRhdGEpKTtcclxuXHJcbiAgICAgICAgc3VwZXIoJ25vZGUnLCBjZik7XHJcbiAgICAgICAgdGhpcy5pZCA9IFNvY2tldC5faWRfTnVtYmVyKys7XHJcbiAgICB9XHJcblxyXG4gICAgcHJvdGVjdGVkIF9zZW5kRGF0YShkYXRhOiBCdWZmZXIpOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xyXG4gICAgICAgICAgICB0aGlzLnNvY2tldC5zZW5kKGRhdGEsIHsgYmluYXJ5OiB0cnVlIH0sIChlcnIpID0+IHtcclxuICAgICAgICAgICAgICAgIGVyciA/IHJlamVjdChlcnIpIDogcmVzb2x2ZSgpO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9KTtcclxuICAgIH1cclxuXHJcbiAgICBjbG9zZSgpOiB2b2lkIHtcclxuICAgICAgICB0aGlzLnNvY2tldC5jbG9zZSgpO1xyXG4gICAgfVxyXG59Il19
