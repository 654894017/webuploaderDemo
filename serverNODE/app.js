/**
 * Created by kazaff on 2014/11/12.
 * ���������ڲ���webuploader��������ԣ����ڴ������Ż��ռ䣬������ʹ������ʽ��Ŀ��
 */

var formidable = require("formidable"),
    http = require("http"),
    util = require("util"),
    fs = require("fs"),
    path = require("path"),
    _ = require("underscore"),
    config = require("./config"),
    wu = require("./webuploader");

http.createServer(function(req, res){

    //���ڷ�Ƭ�ϲ�ʱ��ͬ����ʶλ
    var lockMark = [];

    //����
    res.writeHead(200, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST"
    });

    var action = req.method.toLowerCase();

    if(action == 'post' && req.url == "/fileUpload"){

        var form = new formidable.IncomingForm({uploadDir:"tmp"});  //����EXDEV����
        form.parse(req, function(err, fields, files){

            //console.log(util.inspect({fields: fields, files: files}));

            if(_.isUndefined(fields.status)){ //��Ƭ�ϴ�
                //��Ƭ��Ԫ���ݱ������ļ�����ʽ����Ȼ���ݿ�Ҳ�У��־û�������Ӧ�ó־û���node��ȫ�ֱ����У�����node�������������µ�Ԫ���ݶ�ʧ�����ﴦ��ķ�ʽ����php�汾�ĺ��
                //��������ɼ�https://github.com/kazaff/me.kazaff.article/blob/master/%E8%81%8A%E8%81%8A%E5%A4%A7%E6%96%87%E4%BB%B6%E4%B8%8A%E4%BC%A0.md

                var upDir = "";
                var isChunks = !(_.isUndefined(fields.chunks) || parseInt(fields.chunks) <= 0);
                if(isChunks){
                    upDir = path.join(config.uploadDir, wu.createUniqueFileName(fields));
                }else{
                    upDir = config.uploadDir;
                }

                fs.mkdir(upDir, function(err){
                    if(_.isNull(err) || err.code === "EEXIST"){

                        var newFileName = "";

                        if(isChunks){
                            //����tmp�ļ����޸�ʱ��
                            fs.open(upDir+".tmp", "w", function(err, fd){
                                if(err){
                                    //todo
                                    console.error(err);

                                }else{
                                    var time = new Date();
                                    fs.futimes(fd, time, time, function(err){
                                        if(err){
                                            //todo
                                            console.error(err);
                                        }

                                        fs.close(fd);
                                    });
                                }
                            });


                            newFileName = fields.chunk;
                        }else{
                            newFileName = wu.randomFileName(path.extname(files.file.name));
                        }

                        fs.rename(files.file.path, path.join(upDir, newFileName), function(err){
                            if(err){
                                //todo
                                console.error(err);
                                res.end('{"status":0}');
                                return ;
                            }

                            res.end('{"status":1, "path":'+ newFileName +'}');
                        });

                    }else{
                        //todo
                        console.error(err);
                        res.end('{"status":0}');
                    }
                });


            }else if(fields.status == "md5Check"){  //�봫У��

                //todo ģ��ȥ���ݿ���У��md5�Ƿ����
                if(fields.md5 == "b0201e4d41b2eeefc7d3d355a44c6f5a"){
                    res.end('{"ifExist":1, "path":"kazaff2.jpg"}');
                }else{
                    res.end('{"ifExist":0}');
                }


            }else if(fields.status == "chunkCheck"){  //��ƬУ��

                fs.stat(path.join(config.uploadDir, fields.file, fields.chunkIndex), function(err, stats){
                    if(err || stats.size != fields.size){
                        res.end('{"ifExist":0}');
                    }else{
                        res.end('{"ifExist":1}');
                    }
                });
            }else if(fields.status == "chunksMerge"){   //��Ƭ�ϲ�

                //ͬ������
                if(_.contains(lockMark, fields.file)){

                    res.end('{"status":0}');
                }else{

                    lockMark.push(fields.file);

                    var newFileName = wu.randomFileName(fields.ext);
                    var targetStream = fs.createWriteStream(path.join(config.uploadDir, newFileName));
                    wu.chunksMerge(path.join(config.uploadDir, fields.file), targetStream, fields.chunks, function(err){

                        if(err){
                            //todo
                            console.error(err);
                            res.end('{"status":0}');
                            return ;
                        }

                        targetStream.end(function(){
                            //ɾ���ļ��к�tmp
                            fs.unlink(path.join(config.uploadDir, fields.file) + ".tmp", function(err){
                                if(err){
                                    //todo
                                    console.error(err);
                                }
                            });
                            fs.rmdir(path.join(config.uploadDir, fields.file), function(err){
                                if(err){
                                    //todo
                                    console.error(err);
                                }
                            });

                            lockMark = _.without(lockMark, fields.file);

                            //todo ������ʵ��Ҫ�Ѹ��ļ�����ǰ��У���md5���������ݿ��У����봫���ܼ���

                            res.end('{"status":1, "path":"' + newFileName + '"}');
                        });

                    });
                }
            }

        });

        return;

    }else if(action != 'options'){
        res.writeHead(404);
    }

    res.end();

}).listen(config.port, config.host);