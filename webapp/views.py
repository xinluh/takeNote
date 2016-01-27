from webapp import app
import time
import json
import urllib
from flask import render_template, request,jsonify,Response
from sqlalchemy import create_engine
import pafy
import utils, img_proc_utils, model

@app.route('/')
@app.route('/index')
def index():
    return render_template('main.html')

@app.route('/getImageStream')
@app.route('/getImageStream/<path:url>')
def get_image_stream(url=None):
    if not url: # test
        url = 'https://www.youtube.com/watch?v=XsqtPhra2f0'
    else:
        url = urllib.unquote_plus(url)
    print 'got url', url
    if url.startswith('file://'):
        stream = url.replace('file://','')
        video = None
    else:
        video = pafy.new(url)
        stream = utils.get_youtube_stream_url(video)
    print stream
    if not stream:
        return 'error'
    return Response(stream_frames(stream, video), mimetype="text/event-stream")

def stream_frames(stream, pafy_video = None):
    if pafy_video:
        yield 'event: onstart\ndata: %s\n\n' % json.dumps({'video_length': pafy_video.length,
                                                               'video_title': pafy_video.title,
                                                               # 'video_desc': pafy_video.description,
                                                               'video_author': pafy_video.author})
    else: 
        yield 'event: onstart\ndata: %s\n\n' % json.dumps({'video_length': 5000})

    from tqdm import tqdm
    def on_frame_change(sec,frame):
        if int(sec % 20) == 0:
            yield 'event: onprogress\ndata: %s\n\n' % json.dumps({'sec': int(sec)})

    it = utils.find_text_in_video(
             tqdm(utils.get_frames_from_stream(stream,3, on_frame_change=on_frame_change)),
             lambda frame,base_frames: utils.find_text_in_frame(frame, base_frames, proba_threshold=0.3))

    for blob in it:
        yield 'data: %s\n\n' % json.dumps({'img': utils.img_to_base64_bytes(blob['blob']), #utils.img_to_base64_bytes(255-np.nan_to_num(abs(blob))),
                                             'sec': int(blob['sec']),
                                             'proba': round(blob['proba'],2),
                                             'left_corner': blob['left_corner'],
                                             'size': blob['blob'].shape,
                                             'frame': utils.img_to_base64_bytes(blob['frame'])
                                         })
    print 'onend!'
    yield 'event: onend\ndata: end\n\n'
    raise StopIteration
    
def stream_frames2(stream, pafy_video = None):
    base_frame_sec = -1
    base_frame = None
    test = (pafy_video == None)
    # stream = '/windows/mit/rubakov.mp4' # testing
    if base_frame < 0:
        if pafy_video:
            yield 'event: onstart\ndata: %s\n\n' % json.dumps({'video_length': pafy_video.length,
                                                               'video_title': pafy_video.title,
                                                               # 'video_desc': pafy_video.description,
                                                               'video_author': pafy_video.author})
        else: 
            yield 'event: onstart\ndata: %s\n\n' % json.dumps({'video_length': 5000})

    try:
        for sec, frame in utils.get_frames_from_stream(stream,5):
            if int(sec % 20) == 0:
                yield 'event: onprogress\ndata: %s\n\n' % json.dumps({'sec': int(sec)})
            if base_frame_sec < 0:
                base_frame = frame
                base_frame_sec = sec
                continue
            if test: has_blob = False
            for (xmin,ymin), blob in img_proc_utils.extract_blobs(frame-base_frame, img_proc_pipeline = img_proc_utils.pipeline2):
                proba = model.predict_proba(blob, model='webapp/model.pickle')
                if proba > 0.5:
                    has_blob = True
                    print sec, xmin, ymin,proba
                    yield 'data: %s\n\n' % json.dumps({'img': utils.img_to_base64_bytes(blob), #utils.img_to_base64_bytes(255-np.nan_to_num(abs(blob))),
                                                 'sec': int(sec),
                                                 'proba': proba,
                                                 'left_corner': [xmin,ymin],
                                                 'size': blob.shape,
                                                 'frame': utils.img_to_base64_bytes(frame)
                                             })
                    base_frame = frame
                    base_frame_sec = sec
            if test and has_blob: time.sleep(3)

    except StopIteration:
        print 'onend!'
        yield 'event: onend\ndata: end\n\n'
        raise StopIteration

