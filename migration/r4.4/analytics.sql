create table useranalytics (
id serial not null primary key,
userid int not null,
year int not null,
month int not null
);
create unique index ux_useranalytics on useranalytics(userid, year, month);
grant all on useranalytics to transcriber;
grant all on useranalytics_id_seq to transcriber;


create table countryanalytics (
id serial not null primary key,
country text not null,
year int not null,
month int not null
);
create unique index ux_countryanalytics on countryanalytics(country, year, month);
grant all on countryanalytics to transcriber;
grant all on countryanalytics_id_seq to transcriber;
