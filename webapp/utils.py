import cv2
import pafy
import numpy as np
import types
import model
import img_proc_utils

#from StringIO import StringIO
import urllib

def img_to_base64_bytes(img):
    ret, buf = cv2.imencode('.png',img)
    return urllib.quote(buf.tostring().encode("base64").rstrip('\n'))

def get_frames_from_stream(url, frame_rate_per_sec = 1, gray_scale=True, on_frame_change=None):
    assert(url != None)
    cap = cv2.VideoCapture(url)
    frames_read = 0
#    frame_rate = cap.get(cv2.cv.CV_CAP_PROP_FPS)
    while(True):
        #print cap.get(cv2.cv.CV_CAP_PROP_POS_MSEC)
        ret, frame = cap.read()
        if type(frame) == types.NoneType:
            raise StopIteration
            
        frames_read += 1
        frame = frame.astype(np.float32)
        if ret:
            if gray_scale:
                frame = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            sec = cap.get(cv2.cv.CV_CAP_PROP_POS_MSEC)/1000.
            if on_frame_change:
                on_frame_change(sec,frame)
            yield sec, frame

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

def find_text_in_frame(current_img, baseimgs, modelfile='webapp/model.pickle',proba_threshold = 0.5, debug=False):
    blobs = []
    for baseimg in baseimgs:
        for (xmin,ymin), blob in img_proc_utils.extract_blobs(current_img-baseimg, img_proc_pipeline = img_proc_utils.pipeline_otsu):
            proba = model.predict_proba(blob, model=modelfile)
            if proba > proba_threshold or debug:
                blobs.append({'blob': blob, 'left_corner': [xmin,ymin], 'proba': proba})
        if len(blobs) > 0 and not debug:
            return blobs
    return blobs

def find_text_in_video(frame_iterator, find_text_in_frame_func):
    base_frame = []
    current_blobs = []
    for sec, frame in frame_iterator:
        if len(base_frame) ==  0:
            base_frame = [frame]
            continue
    
        for blob in (b for b in current_blobs if len(b['change_frac']) == 5):
            if np.median(blob['change_frac'])>0.7: # seems stable between frames; take this as a real change
                other_blobs = [b for b in current_blobs if len(b['change_frac']) < 5 
                                                   and img_proc_utils.shared_fraction(blob, b) > 0.4]
                largest_blob = max([blob]+other_blobs, key=lambda x: np.count_nonzero(img_proc_utils.threshold_otsu(x['blob'])>0))
                base_frame = [largest_blob['frame']]
                for b in other_blobs: 
                    #print b['sec']
                    current_blobs.remove(b);
                yield largest_blob 
            current_blobs.remove(blob)

        # compute the change frac with subsequent frames
        for blob in (b for b in current_blobs if len(b['change_frac']) < 5): 
            b = blob.get('blob_bw', img_proc_utils.otsu_thresholded(blob['blob']))
            x, y = blob['left_corner']
            frac = img_proc_utils.changed_fraction(b, img_proc_utils.otsu_thresholded(frame[x:x+b.shape[0],y:y+b.shape[1]]), white_overweight=2)
            blob['change_frac'].append(frac)

        text_blobs = find_text_in_frame_func(frame, base_frame)
        for blob in text_blobs:
            #print blob
            blob.update({'frame': frame, 'sec':sec, 'change_frac':[]})
        current_blobs += text_blobs
