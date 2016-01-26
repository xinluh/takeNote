import numpy as np
from scipy import ndimage, misc
from functools import reduce
from skimage.filters import threshold_otsu, gaussian_filter

def downsample(img, (blocksizex,blocksizey),estimator=np.nanmean, return_downsized=False):
    xs,ys = img.shape
    assert(ys%blocksizey==xs%blocksizex==0)
    diff = estimator( np.concatenate([[img[i::blocksizex,j::blocksizey] 
        for i in range(blocksizex)] 
        for j in range(blocksizey)]), axis=0)
    if return_downsized: return diff
    x,y = np.ogrid[:xs,:ys]
    return diff[x/blocksizex,y/blocksizey]
    
def thresholding_on_gaussian_mean(img, params):
    img_ubyte = img_as_float(img.astype(uint8))
    gaussian = gaussian_filter(img_ubyte, params.get('gaussian_sigma',3))
    threshold1 = np.mean(gaussian)
    return img_ubyte*(gaussian>threshold1)
    
params = {'blocksize':(10,10), 'min_blob_size':1, 'max_blob_fraction':1/3.,'pixel_mask':np.nan,'gaussian_sigma':3}


pipeline2 = [lambda x, params: x*(x>0), # take advantage that addition on blackboard are white
             lambda x, params: x*(x>threshold_otsu(x)), 
             lambda x, params: abs(downsample(x, params['blocksize'], return_downsized=True)),
             lambda x, params: ndimage.grey_closing(x, size=(2, 2), structure=np.ones((2,2))), # make blobs more regular
             #lambda x, params: x > params['threshold']
            ]
pipeline3 = [lambda x, params: x*(x>0), # take advantage that addition on blackboard are white
             thresholding_on_gaussian_mean, 
             lambda x, params: abs(downsample(x, params['blocksize'], return_downsized=True)),
             lambda x, params: ndimage.grey_closing(x, size=(2, 2), structure=np.ones((2,2))), # make blobs more regular
            ]

def frame_selection(img_processed, blobs, nblobs, params): 
    if nblobs < 1: return False
    return not np.any([blobs[blobs==i].size > img_processed.size * params['max_blob_fraction'] for i in xrange(1,nblobs+1)]) 

def blob_selection(blobs, nb, params):
    return blobs[blobs==nb].size > params['min_blob_size'] # only select blob larger than 1 pic
    
def extract_blobs(img, img_proc_pipeline = pipeline3, frame_selection = frame_selection,
                  blob_selection = blob_selection, params = params, orig_img = None, debug=False):
    img_processed = reduce(lambda x, func: func(x, params), [img] + img_proc_pipeline) if img_proc_pipeline else img
    blobs, nblobs = ndimage.label(img_processed,structure=np.ones((3,3)))
    if debug:
        return [((n,n),reduce(lambda x, func: func(x, params), [img] + img_proc_pipeline[:n])) for n in xrange(len(img_proc_pipeline))] + [((0,0),blobs)]

    if frame_selection and not frame_selection(img_processed, blobs,nblobs,params): return []    
    fragments = []
    if orig_img == None: orig_img = img
        
    for blob_num in xrange(1,nblobs+1):
        if blob_selection and not blob_selection(blobs, blob_num, params): continue
        indices = np.argwhere(blobs==blob_num)
        xblocksize, yblocksize = params.get('blocksize',(1,1))
        
        # fragment of original image within bounding box
        ((xmin,ymin),(xmax,ymax)) = np.min(indices,axis=0),np.max(indices,axis=0) 
        #fragment = img[xmin*xblocksize:(xmax+1)*xblocksize, ymin*yblocksize:(ymax+1)*yblocksize]
        
        X,Y = np.ogrid[:(xmax-xmin+1)*xblocksize,:(ymax-ymin+1)*yblocksize]
        
        fragment = orig_img[xmin*xblocksize:(xmax+1)*xblocksize, ymin*yblocksize:(ymax+1)*yblocksize]*(blobs[xmin:xmax+1,ymin:ymax+1][X/xblocksize,Y/yblocksize])
        mask = blobs[xmin:xmax+1,ymin:ymax+1][X/xblocksize,Y/yblocksize]==blob_num
        fragment[~mask] = params.get('pixel_mask',np.nan)
        fragment /= blob_num # stupid work around since saving to sql doesn't really work with the more obvious way 

        fragments.append(((xmin*xblocksize,ymin*yblocksize), fragment))
    return fragments
