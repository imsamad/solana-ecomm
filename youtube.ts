import * as youtubedl from "youtube-dl-exec"


youtubedl.youtubeDl('https://www.youtube.com/watch?v=T5p8rGD0-vs', {
  dumpSingleJson: true,
  noCheckCertificates: true,
  noWarnings: true,
  preferFreeFormats: true,
  addHeader: ['referer:youtube.com', 'user-agent:googlebot'],
  yesPlaylist:true
}).then(output => console.log(output))