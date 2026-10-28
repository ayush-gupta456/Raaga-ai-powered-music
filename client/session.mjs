// Own exactly one request and one Blob URL. Nothing is serialized or persisted.
export class AudioSession {
  constructor(urlAPI=URL){this.urlAPI=urlAPI;this.url=null;this.controller=null;this.version=0;}
  clearAudio(){if(this.url)this.urlAPI.revokeObjectURL(this.url);this.url=null;}
  begin(){this.dispose();this.controller=new AbortController();return {signal:this.controller.signal,version:this.version};}
  accept(blob,version){if(version!==this.version)return null;this.clearAudio();this.url=this.urlAPI.createObjectURL(blob);return this.url;}
  dispose(){this.version++;this.controller?.abort();this.controller=null;this.clearAudio();}
}
