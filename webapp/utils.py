import cv2
import pafy
import numpy as np

#from StringIO import StringIO
import urllib

def img_to_base64_bytes(img):
    ret, buf = cv2.imencode('.png',img)
    return urllib.quote(buf.tostring().encode("base64").rstrip('\n'))

def get_frames_from_stream(url, frame_rate_per_sec = 1, gray_scale=True):
    assert(url != None)
    #cap = cv2.VideoCapture('/windows/mit/rubakov.mp4')
    cap = cv2.VideoCapture(url)
    frames_read = 0
#    frames = []
#    frame_rate = cap.get(cv2.cv.CV_CAP_PROP_FPS)
    while(True):
        #print cap.get(cv2.cv.CV_CAP_PROP_POS_MSEC)
        ret, frame = cap.read()
        frames_read += 1
        frame = frame.astype(np.float32)
        if ret:
            if gray_scale:
                frame = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            yield cap.get(cv2.cv.CV_CAP_PROP_POS_MSEC)/1000., frame

        # seek to next round second
        cap.set(cv2.cv.CV_CAP_PROP_POS_MSEC, frame_rate_per_sec*1000*frames_read) 
        
    cap.release()

def get_youtube_stream_url(video, ext = 'mp4', dimension=640):
    # for s in video.streams:
        # print s.extension, s.dimensions[0]
        # print s.extension == ext, s.dimensions[0] == dimension
    streams = [s for s in video.streams if s.extension == ext and s.dimensions[0]==dimension]
    if len(streams) == 0: return None
    else:  return streams[0].url

