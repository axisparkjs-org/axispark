import { Body, Controller, FileUpload, Path, Post, UploadedFile, UploadedFiles } from '@axisparkjs/http';

const describeFile = (file?: UploadedFile) => file && { fieldName: file.fieldName, originalName: file.originalName, mimeType: file.mimeType, size: file.size };

@Controller('users')
export class UserController {
    @Post(':id/avatar')
    uploadAvatar(@Path('id') id: string, @UploadedFile('avatar') avatar: UploadedFile, @Body() body: Record<string, string>) {
        return { id, avatar: describeFile(avatar), content: avatar?.buffer.toString('utf8'), body };
    }

    @Post('documents')
    uploadDocuments(@UploadedFiles('documents') documents: UploadedFile[]) {
        return { documents: documents.map(describeFile) };
    }

    @Post('all')
    uploadAll(@UploadedFiles() files: UploadedFile[]) {
        return { files: files.map((file) => file.fieldName) };
    }

    @FileUpload({ maxFileSize: 4 * 1024, allowedMimeTypes: ['application/pdf'] })
    @Post('contracts')
    uploadContract(@UploadedFile('file') file: UploadedFile) {
        return { contract: describeFile(file) };
    }
}

@FileUpload({ maxFiles: 1 })
@Controller('single')
export class SingleUploadController {
    @Post('inherited')
    inherited(@UploadedFiles() files: UploadedFile[]) {
        return { files: files.length };
    }

    @FileUpload({ maxFiles: 2 })
    @Post('override')
    override(@UploadedFiles() files: UploadedFile[]) {
        return { files: files.length };
    }
}
