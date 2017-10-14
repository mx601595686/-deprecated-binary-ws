/**
 * 系列化后各个类型所对应的编号
 * 
 * @export
 * @enum {number}
 */
export const enum DataType {
    number,
    string,
    boolean,
    null,
    undefined,
    Array,
    Object,
    Buffer
}