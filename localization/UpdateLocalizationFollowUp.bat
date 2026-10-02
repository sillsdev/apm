cd ..\..
del ..\web\public\localization\strings*.json
copy strings*.json ..\web\public\localization
del strings*.json
copy exported-strings-name.json ..\web\src\store\localization
del exported-strings-name.json
copy localizationReducer.tsx ..\web\src\store\localization\reducers.tsx
del localizationReducer.tsx
copy localizeModel.tsx ..\web\src\store\localization\model.tsx
del localizeModel.tsx
del az\TranscriberAdmin-en-1.2.xliff
del hi\TranscriberAdmin-en-1.2.xliff
del nl\TranscriberAdmin-en-1.2.xliff
del tl\TranscriberAdmin-en-1.2.xliff
del tpi\TranscriberAdmin-en-1.2.xliff
del az\TranscriberDigest-en.xliff
del hi\TranscriberDigest-en.xliff
del nl\TranscriberDigest-en.xliff
del tl\TranscriberDigest-en.xliff
del tpi\TranscriberDigest-en.xliff
pause
