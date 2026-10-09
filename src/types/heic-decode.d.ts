// heic-decode không kèm khai báo kiểu, chỉ dùng hàm giải mã một ảnh.
declare module 'heic-decode' {
  interface DecodedImage {
    width: number;
    height: number;
    /** Điểm ảnh RGBA, 4 byte mỗi điểm. */
    data: Uint8ClampedArray;
  }

  function decode(input: {
    buffer: Buffer | Uint8Array;
  }): Promise<DecodedImage>;

  export = decode;
}
