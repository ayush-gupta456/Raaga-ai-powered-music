export class MusicError extends Error {
  constructor(message, status=502, code='provider_error', retryAfter=0) {
    super(message); this.status=status; this.code=code; this.retryAfter=retryAfter;
  }
}
export async function readJSON(response, limit, status=502) {
  if (!response.body) throw new MusicError('The response was empty.',status,'empty_response');
  const reader=response.body.getReader(), decoder=new TextDecoder();
  let size=0, text='';
  try {
    while(true) {
      const {done,value}=await reader.read(); if(done)break;
      size+=value.byteLength;
      if(size>limit){await reader.cancel();throw new MusicError('The request or audio response is too large. Try a shorter song.',status===400?413:502,'size_limit');}
      text+=decoder.decode(value,{stream:true});
    }
    text+=decoder.decode();
    try{return JSON.parse(text);}catch{throw new MusicError('Received an invalid response. Please try again.',status,'invalid_json');}
  } finally {reader.releaseLock();}
}
export function errorResponse(error) {
  const known=error instanceof MusicError;
  return Response.json({error:known?error.message:'The music service could not complete the request. Please try again.',code:known?error.code:'connection_error'}, {
    status:known?error.status:502,
    headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...(known&&error.retryAfter?{'Retry-After':String(error.retryAfter)}:{})}
  });
}
