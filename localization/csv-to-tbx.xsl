<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="3.0"
    xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
    xmlns:xs="http://www.w3.org/2001/XMLSchema"
    exclude-result-prefixes="xs">

    <xsl:output method="xml" indent="yes" encoding="UTF-8"/>

    <!-- Parameter for the CSV file path -->
    <xsl:param name="csv-file" select="'strings-3u.csv'"/>

    <xsl:template match="/">
        <xsl:variable name="csv-content" select="unparsed-text($csv-file)"/>
        <xsl:variable name="lines" select="tokenize($csv-content, '\r?\n')[normalize-space(.)]"/>
        <xsl:variable name="header" select="tokenize($lines[1], '\t')"/>
        <xsl:variable name="languages" select="$header[position() > 1]"/>

        <xsl:text>&#xa;</xsl:text>
        <xsl:processing-instruction name="xml-model">href="https://raw.githubusercontent.com/LTAC-Global/TBX-Basic_dialect/master/DCA/TBXcoreStructV03_TBX-Basic_integrated.rng" type="application/xml" schematypens="http://relaxng.org/ns/structure/1.0"</xsl:processing-instruction>
        <xsl:text>&#xa;</xsl:text>
        <xsl:processing-instruction name="xml-model">href="https://raw.githubusercontent.com/LTAC-Global/TBX-Basic_dialect/master/DCA/TBX-Basic_DCA.sch" type="application/xml" schematypens="http://purl.oclc.org/dsdl/schematron"</xsl:processing-instruction>
        <xsl:text>&#xa;</xsl:text>

        <tbx type="TBX-Basic" style="dca" xml:lang="en" xmlns="urn:iso:std:iso:30042:ed-2">
            <tbxHeader>
                <fileDesc>
                    <sourceDesc>
                        <p>Audio Project Manager glossary</p>
                    </sourceDesc>
                </fileDesc>
            </tbxHeader>
            <text>
                <body>
                    <xsl:for-each select="$lines[position() > 1]">
                        <xsl:variable name="position" select="position()"/>
                        <xsl:variable name="fields" select="tokenize(., '\t')"/>
                        <xsl:variable name="tag" select="$fields[1]"/>

                        <xsl:if test="normalize-space($tag)">
                            <conceptEntry id="{$position}">
                                <descrip type="translatable">yes</descrip>

                                <!-- Create langSec for each language -->
                                <xsl:for-each select="$languages">
                                    <xsl:variable name="lang-pos" select="position() + 1"/>
                                    <xsl:variable name="term-text" select="$fields[$lang-pos]"/>

                                    <xsl:if test="normalize-space($term-text)">
                                        <langSec xml:lang="{.}">
                                            <termSec>
                                                <term id="{$position * 1000 + $lang-pos}">
                                                    <xsl:value-of select="$term-text"/>
                                                </term>
                                                <xsl:if test=". = 'en'">
                                                    <termNote type="partOfSpeech">other</termNote>
                                                </xsl:if>
                                                <xsl:if test="$tag">
                                                    <descrip type="context">
                                                        <xsl:value-of select="$tag"/>
                                                    </descrip>
                                                </xsl:if>
                                            </termSec>
                                        </langSec>
                                    </xsl:if>
                                </xsl:for-each>
                            </conceptEntry>
                        </xsl:if>
                    </xsl:for-each>
                </body>
            </text>
        </tbx>
    </xsl:template>

</xsl:stylesheet>

