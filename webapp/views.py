from webapp import app
import time
import json
import os
import urllib
from flask import render_template, request,jsonify,Response, send_from_directory
from sqlalchemy import create_engine
from tqdm import tqdm
from collections import defaultdict
import numpy as np
import pafy
import utils, img_proc_utils, model

@app.route('/')
@app.route('/index')
def index():
    return render_template('main.html')

@app.route('/slides')
def slides():
    return render_template('slides.html')

@app.route('/favicon.ico')
def favicon():
    return send_from_directory(os.path.join(app.root_path, 'static'),
                               'favicon.ico', mimetype='image/vnd.microsoft.icon')    
    
@app.route('/getImageStream')
@app.route('/getImageStream/<path:url>')
def get_image_stream(url=None):
    if not url: # test
        url = 'https://www.youtube.com/watch?v=XsqtPhra2f0'
    else:
        url = urllib.unquote_plus(url)
    print 'got url', url
    if url == 'demo':
        stream = '/home/ubuntu/rubakov1.mp4'
        video = None
    elif url.startswith('file://'):
        stream = url.replace('file://','')
        video = None
    else:
        video = pafy.new(url)
        video.url = url
        stream = utils.get_youtube_stream_url(video)
    print stream
    if not stream:
        return 'error'
    return Response(stream_frames(stream, video), mimetype="text/event-stream")

def server_event_msg(data, mtype='message'):
    return 'event: %s\ndata: %s\n\n' % (mtype,json.dumps(data))

def stream_frames(stream, pafy_video = None):
    demo_diff = 0
    video_length = pafy_video.length if pafy_video else (5412-demo_diff if 'rubakov1' in stream else 5000)
    if pafy_video:
        yield server_event_msg({'video_length': pafy_video.length,
                                'video_title': pafy_video.title,
                                'video_desc': pafy_video.description,
                                'video_author': pafy_video.author,
                                'video_url': pafy_video.url},
                               'onstart')
    else:
        if 'rubakov1' in stream:
            demo_diff = 4*60 # the demo video is four min in
            yield server_event_msg({"video_author": "Galileo Galilei",
                                    "video_length": 5412-demo_diff,
                                    "video_title": "Early Universe - V. Rubakov - lecture 1/9",
                                    "video_url": "https://www.youtube.com/watch?v=XsqtPhra2f0",
                                    "video_desc": "GGI lectures on the theory of fundamental interactions, January 2015\nhttp://heidi.pd.infn.it/html/GGI/index.php"},
                                   'onstart')
        else:
            yield server_event_msg({'video_length': 5000,'video_title': stream }, 'onstart')
            

    hist = defaultdict(float)
    it = utils.find_text_in_video(
             utils.get_frames_from_stream(stream,3),
             lambda frame,base_frames: utils.find_text_in_frame(frame, base_frames, proba_threshold=0.5))

    for dtype, data in it:
        if dtype == 'new_frame':
            yield server_event_msg({'sec': int(data[0])},'onprogress')
        elif dtype == 'new_blob':
            yield server_event_msg({'img': utils.img_to_base64_bytes(data['blob']), #utils.img_to_base64_bytes(255-np.nan_to_num(abs(blob))),
                                             'sec': int(data['sec']+demo_diff),
                                             'proba': round(data['proba'],2),
                                             'left_corner': data['left_corner'],
                                             'size': data['blob'].shape,
                                             'n_sameblobs': data['n_sameblobs'],
                                             # 'frame': utils.img_to_base64_bytes(data['frame'])
                                         })
            if 'blob_bw' not in data: data['blob_bw'] = img_proc_utils.otsu_thresholded(data['blob'])
            hist[(int(data['sec']+demo_diff)/60)] += np.count_nonzero(data['blob_bw'][data['blob_bw']>0])
            
            # print hist, {'hist': [{'x': k, 'y': v} for k,v in hist.iteritems()]}
            # yield server_event_msg({'hist': [{'x': k, 'y': int(v/10.)} for k,v in hist.iteritems()]}, 'onhist')
            yield server_event_msg({'hist': [{'x': i, 'y':  hist.get(i,0)} for i in xrange(video_length/60)]}, 'onhist')
        elif dtype == "erased_blob":
            yield server_event_msg({'sec': int(data['sec']+demo_diff),
                                    'removed_sec': int(data['removed_at_sec']+demo_diff),
                                    'left_corner': data['left_corner']},
                                   'onerasure')
            hist[(int(data['removed_at_sec']+demo_diff)/60)] -= np.count_nonzero(data['blob_bw'][data['blob_bw']>0])
            yield server_event_msg({'hist': [{'x': i, 'y':  hist.get(i,0)} for i in xrange(video_length/60)]}, 'onhist')

    yield server_event_msg({'end':True}, 'onend')
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

