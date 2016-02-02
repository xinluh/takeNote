import cv2
import pafy
import numpy as np
from collections import deque
import types
import model
import img_proc_utils

from StringIO import StringIO
import Image
import urllib

def img_to_base64_bytes(img):
    img *= (img>0)
    mask = ((~np.isnan(img))*255).astype(np.uint8)
    im = Image.fromarray(img.astype(np.uint8))
    strio = StringIO()
    im.putalpha(Image.fromarray(mask))
    im.save(strio, "png")
    return urllib.quote(strio.getvalue().encode("base64").rstrip('\n'))


def img_to_base64_bytes2(img):
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
            if proba >= proba_threshold or debug:
                blobs.append({'blob': blob, 'left_corner': [xmin,ymin], 'proba': proba})
        if len(blobs) > 0 and not debug:
            return blobs
    return blobs

def find_text_in_video(frame_iterator, find_text_in_frame_func, stability_threshold=5):
    base_frame = []
    pending_blobs = []
    past_blobs = []

    frame_queue = deque(maxlen=stability_threshold) # general buffer
    rewinding_queue = deque()
    frame_iterator = iter(frame_iterator)

    def next_frame():
        while True:
            if len(rewinding_queue) > 0: yield rewinding_queue.popleft()
            else: yield frame_iterator.next()

    def rewind(nframe):
        assert(nframe <= len(frame_queue))
        for _ in xrange(len(frame_queue)-nframe): frame_queue.popleft()
        rewinding_queue.extend(frame_queue)

    for sec, frame in next_frame():
        frame_queue.append((sec,frame))
        yield 'new_frame', (sec,frame)

        if len(base_frame) ==  0:
            base_frame = [frame]
            continue

        for blob in past_blobs[:]:
            if len(blob.get('removed_changed_frac',[])) >= stability_threshold:
                if np.median(blob['removed_changed_frac']) > 0.4: # erasure seems stable
                    past_blobs.remove(blob)
                    yield 'erased_blob', blob 
                    # todo rewind?
                    # print 'frame reset at', blob['removed_at_sec']
                    base_frame = [blob['removed_at_frame']] # reset base frame 
                else: # probably not actual erasure
                    del blob['removed_at_sec'], blob['removed_at_frame'], blob['removed_changed_frac']
            
        for blob in past_blobs:
            b = blob.get('blob_bw', img_proc_utils.otsu_thresholded(blob['blob']))
            x, y = blob['left_corner']
            current_blob_neg = ~(img_proc_utils.otsu_thresholded(frame[x:x+b.shape[0],y:y+b.shape[1]]).astype(np.bool))
            frac = img_proc_utils.unchanged_fraction(b, current_blob_neg, white_overweight=2)
            if 'removed_at_sec' in blob: # pending erasure
                blob['removed_changed_frac'].append(frac)
            elif frac > 0.4:
                blob['removed_at_sec'] = int(sec)
                blob['removed_at_frame'] = frame
                blob['removed_changed_frac'] = [frac]

        # which pending blob is stable and thus a real text change? 
        for blob in (b for b in pending_blobs if len(b['unchange_frac']) == stability_threshold):
            if np.median(blob['unchange_frac'])>0.7: # seems stable between frames
                other_blobs = [b for b in pending_blobs if len(b['unchange_frac']) < stability_threshold 
                                                   and img_proc_utils.shared_fraction(blob, b) > 0.4]
                largest_blob = max([blob]+other_blobs, key=lambda x: np.count_nonzero(img_proc_utils.threshold_otsu(x['blob'])>0))
                base_frame = [largest_blob['frame']] # reset base frame 
                for b in other_blobs: 
                    pending_blobs.remove(b);
                past_blobs.append(largest_blob)
                largest_blob['n_sameblobs'] = [b['proba'] for b in [blob]+other_blobs]
                yield 'new_blob', largest_blob 
            pending_blobs.remove(blob)
            
        # compute the change frac with subsequent frames
        for blob in (b for b in pending_blobs if len(b['unchange_frac']) < stability_threshold): 
            b = blob.get('blob_bw', img_proc_utils.otsu_thresholded(blob['blob']))
            x, y = blob['left_corner']
            frac = img_proc_utils.unchanged_fraction(b, img_proc_utils.otsu_thresholded(frame[x:x+b.shape[0],y:y+b.shape[1]]), white_overweight=2)
            blob['unchange_frac'].append(frac)

        # calculate new blobs
        text_blobs = find_text_in_frame_func(frame, base_frame)
        for blob in text_blobs:
            #print blob
            blob.update({'frame': frame, 'sec': int(sec), 'unchange_frac':[]})
        pending_blobs += text_blobs
