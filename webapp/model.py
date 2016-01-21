# this file is automatically exported from jupyter nb
import pickle
import numpy as np
from skimage.filters import threshold_otsu, threshold_adaptive
from skimage.feature import greycomatrix,greycoprops

props_to_use = ['aspect_ratio', u'extent', u'grey_dissimilarity',
                 u'grey_energy', u'max_intensity', u'median_intensity']
def calc_blob_property(b, keys = None):
    props = {}
    greycovmat = greycomatrix(np.nan_to_num((b/2.)+128), [2], [0], 256, symmetric=True, normed=True) #this func expects 0< pixel value < 256
    props['grey_dissimilarity'] = greycoprops(greycovmat, 'dissimilarity')[0, 0] 
    props['grey_energy'] = greycoprops(greycovmat, 'energy')[0, 0] 
    props['aspect_ratio'] = b.shape[0]*1./b.shape[1] 
    props['extent'] = 1.*np.count_nonzero(b>threshold_otsu(np.nan_to_num(b))) / np.count_nonzero(~np.isnan(b))  # fraction of non zero pixels 
    props['median_intensity'] = np.nanmedian(abs(b)) 
    props['max_intensity'] = np.nanmax(abs(b)) 
    props['max_intensity'] = np.nanmax(abs(b)) 
    if keys:
        return [props[k] for k in keys]
    else: return props
    
def predict(img, model = 'model.pickle'):
    with open(model,'rb') as f: clf = pickle.load(f)
    return clf.predict([calc_blob_property(img, props_to_use)])[0]

#predict(bb[0],model='webapp/model.pickle')