import React, { useState, useCallback } from 'react';
import { IconUpload, IconFile, IconX, IconTrash } from "@tabler/icons-react";
import CryptoJS from 'crypto-js';

import { AdminLayout } from "~/components/admin-layout";
import { useUser } from "~/hooks/use-user";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";

interface FileWithMetadata {
  file: File;
  name: string;
  description: string;
  sha1: string;
  tagId: number;
  preview?: string;
}

interface UploadResult {
  success_count: number;
  failed_count: number;
  total_count: number;
  success_files: Array<{
    id: number;
    name: string;
    description: string;
    size: number;
    tag_id: number;
    content_type: number;
  }>;
  failed_files: Array<{
    file_name: string;
    error: string;
  }>;
}

// 计算文件的SHA1哈希值 - 兼容非HTTPS环境
async function calculateSHA1(file: File): Promise<string> {
  // 检查是否支持 crypto.subtle (HTTPS 或 localhost)
  if (window.crypto && window.crypto.subtle) {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest('SHA-1', arrayBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      return hashHex;
    } catch (error) {
      console.warn('crypto.subtle 不可用，使用备用方案:', error);
    }
  }
  
  // 备用方案：使用 crypto-js 库（兼容 HTTP 环境）
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const arrayBuffer = event.target?.result as ArrayBuffer;
        const wordArray = CryptoJS.lib.WordArray.create(arrayBuffer);
        const hash = CryptoJS.SHA1(wordArray).toString();
        resolve(hash);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsArrayBuffer(file);
  });
}

export default function UploadFiles() {
  const [selectedFiles, setSelectedFiles] = useState<FileWithMetadata[]>([]);
  const [isCalculatingHashes, setIsCalculatingHashes] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadResult, setUploadResult] = useState<{ success: boolean; data?: UploadResult; error?: string } | null>(null);

  // 获取用户信息
  const { userInfo, logout } = useUser();
  const adminInfo = userInfo ? {
    name: userInfo.nickname || userInfo.username || '管理员',
    role: userInfo.role || 'admin'
  } : undefined;

  const handleFileSelect = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    // 检查文件数量限制
    const maxFiles = 30;
    const currentFileCount = selectedFiles.length;
    const newFileCount = files.length;
    const totalFiles = currentFileCount + newFileCount;

    if (totalFiles > maxFiles) {
      alert(`最多只能同时上传${maxFiles}个文件。当前已选择${currentFileCount}个文件，您尝试添加${newFileCount}个文件，总数为${totalFiles}个文件，超出限制。`);
      // 清空input的值，避免用户认为文件已被选择
      event.target.value = '';
      return;
    }

    setIsCalculatingHashes(true);
    
    try {
      const filesWithMetadata: FileWithMetadata[] = await Promise.all(
        files.map(async (file) => {
          const sha1 = await calculateSHA1(file);
          const preview = file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined;
          
          // 获取不带扩展名的文件名作为默认描述
          const nameWithoutExtension = file.name.replace(/\.[^/.]+$/, '');
          
          return {
            file,
            name: file.name,
            description: nameWithoutExtension,
            sha1,
            tagId: 0,
            preview,
          };
        })
      );

      setSelectedFiles(prev => [...prev, ...filesWithMetadata]);
    } catch (error) {
      console.error('计算文件哈希失败:', error);
      alert('计算文件哈希失败，请重试');
    } finally {
      setIsCalculatingHashes(false);
    }
  }, []);

  const updateFileMetadata = useCallback((index: number, field: keyof FileWithMetadata, value: string | number) => {
    setSelectedFiles(prev => 
      prev.map((item, i) => 
        i === index ? { ...item, [field]: value } : item
      )
    );
  }, []);

  const removeFile = useCallback((index: number) => {
    setSelectedFiles(prev => {
      const newFiles = prev.filter((_, i) => i !== index);
      // 清理预览URL
      if (prev[index]?.preview) {
        URL.revokeObjectURL(prev[index].preview!);
      }
      return newFiles;
    });
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    
    if (selectedFiles.length === 0) {
      alert('请至少选择一个文件');
      return;
    }

    // 验证必填字段
    const invalidFiles = selectedFiles.filter(file => !file.name.trim() || !file.sha1);
    if (invalidFiles.length > 0) {
      alert('请确保所有文件都有名称和SHA1值');
      return;
    }

    setIsSubmitting(true);
    setUploadResult(null);

    try {
      const formData = new FormData();
      
      // 添加文件
      selectedFiles.forEach((fileData) => {
        formData.append('files', fileData.file);
      });
      
      // 添加元数据
      selectedFiles.forEach((fileData) => {
        formData.append('names', fileData.name);
        formData.append('descriptions', fileData.description);
        formData.append('sha1s', fileData.sha1);
        formData.append('tag_ids', fileData.tagId.toString());
      });

      const response = await fetch('/api/admin/files/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`上传失败: ${response.statusText}`);
      }

      const result = await response.json();
      setUploadResult({ success: true, data: result.data });
      setSelectedFiles([]); // 清空文件列表
    } catch (error: any) {
      setUploadResult({ success: false, error: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AdminLayout
      adminInfo={adminInfo}
      onLogout={logout}
    >
      {/* 页面标题 */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">文件上传</h1>
        <p className="text-gray-600">批量上传多个文件到系统资源库，支持图片预览和自动SHA1计算</p>
      </div>

      <div className="space-y-8">
        {/* 文件选择区域 */}
        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-3 text-slate-800">
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                <IconUpload className="h-4 w-4 text-blue-600" />
              </div>
              选择文件
            </CardTitle>
            <CardDescription className="text-slate-600">
              选择要上传的文件，系统将自动计算文件哈希值并生成预览
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="border-2 border-dashed border-slate-300 rounded-xl p-12 text-center hover:border-blue-400 hover:bg-blue-50/50 transition-all duration-200">
              <input
                type="file"
                multiple
                onChange={handleFileSelect}
                className="hidden"
                id="fileInput"
                disabled={isCalculatingHashes || isSubmitting}
              />
              <div className="flex flex-col items-center gap-6">
                <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center">
                  <IconUpload className="h-8 w-8 text-blue-600" />
                </div>
                <div className="space-y-3 text-center">
                  <Button
                    type="button"
                    onClick={() => document.getElementById('fileInput')?.click()}
                    disabled={isCalculatingHashes || isSubmitting || selectedFiles.length >= 30}
                    size="lg"
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {isCalculatingHashes ? '计算文件哈希中...' : selectedFiles.length >= 30 ? '已达文件上限' : '选择文件'}
                  </Button>
                  <p className="text-sm text-slate-500">
                    支持多文件上传，最多30个文件，单个文件最大2MB
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 已选文件列表 */}
        {selectedFiles.length > 0 && (
          <Card className="border-slate-200">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-slate-800">
                  已选文件 ({selectedFiles.length}/30)
                </CardTitle>
                {selectedFiles.length >= 8 && (
                  <span className="text-sm text-orange-600 font-medium bg-orange-50 px-3 py-1 rounded-full">
                    {selectedFiles.length >= 30 ? '已达上限' : `还可添加${30 - selectedFiles.length}个文件`}
                  </span>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {selectedFiles.map((fileData, index) => (
                  <div key={index} className="bg-slate-50 border border-slate-200 rounded-xl p-6">
                    <div className="flex items-start space-x-6">
                      {/* 文件预览 */}
                      <div className="flex-shrink-0">
                        {fileData.preview ? (
                          <img
                            src={fileData.preview}
                            alt="预览"
                            className="w-20 h-20 object-cover rounded-lg border-2 border-white shadow-sm"
                          />
                        ) : (
                          <div className="w-20 h-20 bg-white rounded-lg border-2 border-slate-200 flex items-center justify-center shadow-sm">
                            <IconFile className="h-8 w-8 text-slate-400" />
                          </div>
                        )}
                      </div>

                      {/* 文件信息表单 */}
                      <div className="flex-1 grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor={`name-${index}`} className="text-slate-700 font-medium">文件名称 *</Label>
                          <Input
                            id={`name-${index}`}
                            type="text"
                            value={fileData.name}
                            onChange={(e) => updateFileMetadata(index, 'name', e.target.value)}
                            required
                            className="border-slate-300 focus:border-blue-500 focus:ring-blue-500"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor={`tagId-${index}`} className="text-slate-700 font-medium">标签ID</Label>
                          <Input
                            id={`tagId-${index}`}
                            type="number"
                            value={fileData.tagId}
                            onChange={(e) => updateFileMetadata(index, 'tagId', parseInt(e.target.value) || 0)}
                            min="0"
                            className="border-slate-300 focus:border-blue-500 focus:ring-blue-500"
                          />
                        </div>

                        <div className="sm:col-span-2 space-y-2">
                          <Label htmlFor={`description-${index}`} className="text-slate-700 font-medium">描述</Label>
                          <Textarea
                            id={`description-${index}`}
                            value={fileData.description}
                            onChange={(e) => updateFileMetadata(index, 'description', e.target.value)}
                            rows={2}
                            placeholder="文件描述（可选）"
                            className="border-slate-300 focus:border-blue-500 focus:ring-blue-500"
                          />
                        </div>

                        <div className="sm:col-span-2 space-y-2">
                          <Label htmlFor={`sha1-${index}`} className="text-slate-700 font-medium">SHA1 哈希</Label>
                          <Input
                            id={`sha1-${index}`}
                            type="text"
                            value={fileData.sha1}
                            readOnly
                            className="font-mono text-xs bg-slate-100 border-slate-300"
                          />
                        </div>

                        <div className="sm:col-span-2 text-sm text-slate-500">
                          文件大小: {(fileData.file.size / 1024).toFixed(1)} KB
                        </div>
                      </div>

                      {/* 删除按钮 */}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeFile(index)}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                      >
                        <IconX className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* 上传表单 */}
        {selectedFiles.length > 0 && (
          <Card className="border-slate-200">
            <CardContent className="p-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="flex flex-col sm:flex-row gap-4 sm:justify-between sm:items-center">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setSelectedFiles([])}
                    disabled={isSubmitting}
                    className="flex items-center gap-2 border-slate-300 text-slate-700 hover:bg-slate-50"
                  >
                    <IconTrash className="h-4 w-4" />
                    清空所有文件
                  </Button>

                  <Button
                    type="submit"
                    disabled={isSubmitting || selectedFiles.length === 0}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700"
                    size="lg"
                  >
                    <IconUpload className="h-4 w-4" />
                    {isSubmitting ? '上传中...' : `上传 ${selectedFiles.length} 个文件`}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* 上传结果显示 */}
        {uploadResult && (
          <Card className={`border-2 ${uploadResult.success ? 'border-emerald-200 bg-emerald-50/50' : 'border-red-200 bg-red-50/50'}`}>
            <CardContent className="p-6">
              {uploadResult.success ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                    <h4 className="font-semibold text-emerald-800 text-lg">上传完成</h4>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div className="bg-white rounded-lg p-4 border border-emerald-200">
                      <div className="text-2xl font-bold text-slate-800">{uploadResult.data?.total_count}</div>
                      <div className="text-sm text-slate-600">总文件数</div>
                    </div>
                    <div className="bg-white rounded-lg p-4 border border-emerald-200">
                      <div className="text-2xl font-bold text-emerald-600">{uploadResult.data?.success_count}</div>
                      <div className="text-sm text-slate-600">成功</div>
                    </div>
                    <div className="bg-white rounded-lg p-4 border border-emerald-200">
                      <div className="text-2xl font-bold text-orange-600">{uploadResult.data?.failed_count}</div>
                      <div className="text-sm text-slate-600">失败</div>
                    </div>
                  </div>
                  
                  {uploadResult.data?.failed_files && uploadResult.data.failed_files.length > 0 && (
                    <Card className="border-amber-200 bg-amber-50">
                      <CardContent className="p-4">
                        <p className="font-medium text-amber-800 mb-3">失败的文件:</p>
                        <div className="space-y-2">
                          {uploadResult.data.failed_files.map((file, index) => (
                            <div key={index} className="text-sm text-amber-700 bg-amber-100 p-3 rounded-lg">
                              <span className="font-medium">{file.file_name}</span>: {file.error}
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                    <h4 className="font-semibold text-red-800 text-lg">上传失败</h4>
                  </div>
                  <p className="text-red-700 bg-white p-4 rounded-lg border border-red-200">{uploadResult.error}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
}
