cd ..\..
del ..\public\localization\strings*.json
copy strings*.json ..\src\renderer\public\localization
del strings*.json
copy exported-strings-name.json ..\src\renderer\src\store\localization
del exported-strings-name.json
copy localizationReducer.tsx ..\src\renderer\src\store\localization\reducers.tsx
del localizationReducer.tsx
copy localizeModel.tsx ..\src\renderer\src\store\localization\model.tsx
del localizeModel.tsx
pause
