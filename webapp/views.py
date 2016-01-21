from webapp import app
import pafy
from flask import render_template, request,jsonify,Response
from sqlalchemy import create_engine
import time
import utils, img_proc_utils, model

@app.route('/')
@app.route('/index')
def index():
    return render_template('main.html')

@app.route('/getimages',methods=['POST'])
def get_images():
    engine_url = 'postgres://postgres:postgres@localhost/fragments_db'
    engine = create_engine(engine_url)
    
    url = request.form['url']
    video = pafy.new(url)
    streams = [s for s in video.streams if s.extension == 'mp4' and s.dimensions[0]==640]
    if len(streams) == 0: return jsonify({'success':False})
    youtube_link = streams[0].url
    return jsonify({'success':True, 'url':youtube_link})

@app.route('/stream')
def stream():
    return Response(event_stream(), mimetype="text/event-stream")

@app.route('/getImageStream')
def get_image_stream():
    url = 'https://www.youtube.com/watch?v=XsqtPhra2f0'
    video = pafy.new(url)
    stream = utils.get_youtube_stream_url(video)
    print stream
    if not stream:
        return 'error'
    return Response(stream_frames(stream), mimetype="text/event-stream")
    
    # return jsonify({'success':True, 'url':youtube_link})
    
def stream_frames(stream):
    
    try:
        base_frame_sec = -1
        base_frame = None
        for sec, frame in utils.get_frames_from_stream(stream,2):
            # print 'data: %s\n\n' % utils.img_to_base64_bytes(frame)
            print sec
            if base_frame_sec < 0:
                base_frame = frame
                base_frame_sec = sec
                continue
            for (xmin,ymin), blob in img_proc_utils.extract_blobs(frame-base_frame):
                if model.predict(blob, model='webapp/model.pickle'):
                    print xmin, ymin
                    yield 'data: %s\n\n' % utils.img_to_base64_bytes(blob)
                    base_frame = frame
                    base_frame_sec = sec
                elif int(sec - base_frame_sec)%100 == 0:
                    yield 'data: %s\n\n' % utils.img_to_base64_bytes(blob)
            #yield 'data: %s\n\n' % utils.img_to_base64_bytes(frame)
    except StopIteration:
            yield 'data: end'
            raise StopIteration

def event_stream():
    import time
    i = 0
    while True:
        time.sleep(3)
        i+= 1
        print i
        yield 'data: %s\n\n'%i
        if i > 20: raise StopIteration
