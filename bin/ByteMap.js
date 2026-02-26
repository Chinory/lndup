explain the code

class ByteMap {
  constructor() {
	  this.V = [];
	  this.I = Buffer.alloc(256);
  }
  set(k, v) {
		const i = this.I[k],
    n = 255 - this.V.length;
		if (i || n < 0) {
      this.V[255 - i] = v;
    } else {
      this.I[k] = n;
      this.V.push(v);
    }
  }
	get(k) {
		return this.V[255 - this.I[k]];
	}
	has(k) {
		return this.V.length + this.I[k] > 255;
	}



  has(k) {
	  return (255 - this.I[k]) < this.V.length;
  }

  get size() {
	  return this.V.length;
  }
}

// let i = this.B[k];
	  // if (i) {
		//   this.A[255 - i] = v;
    // } else if (i = 256 - this.A.length) {
    //   this.B[k] = i - 1;
    //   this.A.push(v);
    // } else {
    //   this.A[255] = v;
    // }