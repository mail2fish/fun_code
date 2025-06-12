import React, { useState, useCallback } from 'react';
import { IconUpload, IconFile, IconX, IconTrash } from "@tabler/icons-react";
import CryptoJS from 'crypto-js';

import { AppSidebar } from "~/components/my-app-sidebar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "~/components/ui/breadcrumb";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { Separator } from "~/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "~/components/ui/sidebar";

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
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator
              orientation="vertical"
              className="mr-2 data-[orientation=vertical]:h-4"
            />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem className="hidden md:block">
                  <BreadcrumbLink href="#">
                    文件管理
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block" />
                <BreadcrumbItem>
                  <BreadcrumbPage>多文件上传</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
          <div className="ml-auto mr-4 flex items-center gap-2">
            <IconUpload className="h-5 w-5 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">文件上传管理</span>
          </div>
        </header>
        
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <IconUpload className="h-5 w-5" />
                多文件上传
              </CardTitle>
              <CardDescription>
                上传多个文件并设置相关信息，支持图片预览和自动SHA1计算
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
              {/* 文件选择区域 */}
              <div className="space-y-2">
                <Label htmlFor="fileInput">选择文件</Label>
                <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center hover:border-muted-foreground/50 transition-colors">
                  <input
                    type="file"
                    multiple
                    onChange={handleFileSelect}
                    className="hidden"
                    id="fileInput"
                    disabled={isCalculatingHashes || isSubmitting}
                  />
                  <div className="flex flex-col items-center gap-4">
                    <IconUpload className="h-12 w-12 text-muted-foreground" />
                    <div className="space-y-2 text-center">
                      <Button
                        type="button"
                        onClick={() => document.getElementById('fileInput')?.click()}
                        disabled={isCalculatingHashes || isSubmitting || selectedFiles.length >= 30}
                        size="lg"
                      >
                        {isCalculatingHashes ? '计算文件哈希中...' : selectedFiles.length >= 30 ? '已达文件上限' : '选择文件'}
                      </Button>
                      <p className="text-sm text-muted-foreground">
                        支持多文件上传，最多30个文件，单个文件最大2MB
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* 已选文件列表 */}
              {selectedFiles.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-semibold">
                      已选文件 ({selectedFiles.length}/30)
                    </Label>
                    {selectedFiles.length >= 8 && (
                      <span className="text-sm text-orange-600 font-medium">
                        {selectedFiles.length >= 30 ? '已达上限' : `还可添加${30 - selectedFiles.length}个文件`}
                      </span>
                    )}
                  </div>
                  <div className="space-y-4">
                    {selectedFiles.map((fileData, index) => (
                      <Card key={index} className="border-muted">
                        <CardContent className="p-4">
                          <div className="flex items-start space-x-4">
                            {/* 文件预览 */}
                            <div className="flex-shrink-0">
                              {fileData.preview ? (
                                <img
                                  src={fileData.preview}
                                  alt="预览"
                                  className="w-16 h-16 object-cover rounded border"
                                />
                              ) : (
                                <div className="w-16 h-16 bg-muted rounded border flex items-center justify-center">
                                  <IconFile className="h-8 w-8 text-muted-foreground" />
                                </div>
                              )}
                            </div>

                            {/* 文件信息表单 */}
                            <div className="flex-1 grid grid-cols-1 gap-4 sm:grid-cols-2">
                              <div className="space-y-2">
                                <Label htmlFor={`name-${index}`}>文件名称 *</Label>
                                <Input
                                  id={`name-${index}`}
                                  type="text"
                                  value={fileData.name}
                                  onChange={(e) => updateFileMetadata(index, 'name', e.target.value)}
                                  required
                                />
                              </div>

                              <div className="space-y-2">
                                <Label htmlFor={`tagId-${index}`}>标签ID</Label>
                                <Input
                                  id={`tagId-${index}`}
                                  type="number"
                                  value={fileData.tagId}
                                  onChange={(e) => updateFileMetadata(index, 'tagId', parseInt(e.target.value) || 0)}
                                  min="0"
                                />
                              </div>

                              <div className="sm:col-span-2 space-y-2">
                                <Label htmlFor={`description-${index}`}>描述</Label>
                                <Textarea
                                  id={`description-${index}`}
                                  value={fileData.description}
                                  onChange={(e) => updateFileMetadata(index, 'description', e.target.value)}
                                  rows={2}
                                  placeholder="文件描述（可选）"
                                />
                              </div>

                              <div className="sm:col-span-2 space-y-2">
                                <Label htmlFor={`sha1-${index}`}>SHA1 哈希</Label>
                                <Input
                                  id={`sha1-${index}`}
                                  type="text"
                                  value={fileData.sha1}
                                  readOnly
                                  className="font-mono text-xs bg-muted"
                                />
                              </div>

                              <div className="sm:col-span-2 text-sm text-muted-foreground">
                                文件大小: {(fileData.file.size / 1024).toFixed(1)} KB
                              </div>
                            </div>

                            {/* 删除按钮 */}
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => removeFile(index)}
                              className="text-destructive hover:text-destructive/80"
                            >
                              <IconX className="h-4 w-4" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {/* 上传表单 */}
              {selectedFiles.length > 0 && (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <Separator />
                  <div className="flex flex-col sm:flex-row gap-4 sm:justify-between sm:items-center">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setSelectedFiles([])}
                      disabled={isSubmitting}
                      className="flex items-center gap-2"
                    >
                      <IconTrash className="h-4 w-4" />
                      清空所有文件
                    </Button>

                    <Button
                      type="submit"
                      disabled={isSubmitting || selectedFiles.length === 0}
                      className="flex items-center gap-2"
                      size="lg"
                    >
                      <IconUpload className="h-4 w-4" />
                      {isSubmitting ? '上传中...' : `上传 ${selectedFiles.length} 个文件`}
                    </Button>
                  </div>
                </form>
              )}

              {/* 上传结果显示 */}
              {uploadResult && (
                <Card className={uploadResult.success ? 'border-green-200 bg-green-50/50' : 'border-red-200 bg-red-50/50'}>
                  <CardContent className="p-4">
                    {uploadResult.success ? (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-green-600 rounded-full"></div>
                          <h4 className="font-semibold text-green-800">上传完成</h4>
                        </div>
                        <div className="text-sm text-green-700 space-y-1">
                          <p>总文件数: <span className="font-medium">{uploadResult.data?.total_count}</span></p>
                          <p>成功: <span className="font-medium text-green-600">{uploadResult.data?.success_count}</span></p>
                          <p>失败: <span className="font-medium text-orange-600">{uploadResult.data?.failed_count}</span></p>
                          
                          {uploadResult.data?.failed_files && uploadResult.data.failed_files.length > 0 && (
                            <Card className="mt-3 border-yellow-200 bg-yellow-50">
                              <CardContent className="p-3">
                                <p className="font-medium text-yellow-800 mb-2">失败的文件:</p>
                                <div className="space-y-1">
                                  {uploadResult.data.failed_files.map((file, index) => (
                                    <div key={index} className="text-xs text-yellow-700 bg-yellow-100 p-2 rounded">
                                      <span className="font-medium">{file.file_name}</span>: {file.error}
                                    </div>
                                  ))}
                                </div>
                              </CardContent>
                            </Card>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-red-600 rounded-full"></div>
                          <h4 className="font-semibold text-red-800">上传失败</h4>
                        </div>
                        <p className="text-sm text-red-700">{uploadResult.error}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </CardContent>
          </Card>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
